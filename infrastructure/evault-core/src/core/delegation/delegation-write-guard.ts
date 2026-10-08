import { createHash, randomUUID } from "node:crypto";
import {
    COMPANY_ONTOLOGY,
    canonicalJson,
    checkGrantAuthorization,
    checkScopes,
    DELEGATION_ONTOLOGY,
    type DelegationRecord,
    evaluateDelegation,
    isScopeSubset,
    isWindowWithin,
    ROLE_ONTOLOGY,
    type RoleRecord,
    SHAREHOLDING_ONTOLOGY,
    type VerifySignature,
} from "@metastate-foundation/delegation";
import type { AwarenessWriteContext, DbService } from "../db/db.service";

/** Records whose writes decide who may sign for a company. */
export const GOVERNED_ONTOLOGIES = [
    COMPANY_ONTOLOGY,
    ROLE_ONTOLOGY,
    DELEGATION_ONTOLOGY,
    SHAREHOLDING_ONTOLOGY,
];

export type DelegationWriteErrorCode =
    | "UNSIGNED"
    | "BAD_AUTHORIZATION"
    | "NOT_AUTHORIZED"
    | "REPLAYED_GRANT"
    | "NO_COMPANY"
    | "COMPANY_EXISTS"
    | "INVALID_RECORD"
    | "IMMUTABLE";

export class DelegationWriteError extends Error {
    constructor(
        readonly code: DelegationWriteErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "DelegationWriteError";
    }
}

type Record_ = Record<string, any>;

type Existing = { id: string; ontology: string; parsed: Record_ };

/** What a write intends; `id` is known for updates and id-preserving creates. */
export type IntendedWrite = {
    ontology: string;
    payload: Record_;
    id?: string;
};

/** Handed back by `before*` and passed to `after` once the write landed. */
export type GuardTicket = {
    governed: boolean;
    claimToken?: string;
    previous?: Existing | null;
    next?: { ontology: string; parsed: Record_ };
};

const UNGOVERNED: GuardTicket = { governed: false };

/**
 * Enforces company signing authority on writes to a company's own eVault.
 *
 * A Company with `directors`, and every Role, Delegation and Shareholding
 * naming the vault, must carry a `w3ds-grant/v1` authorization from someone
 * entitled to make that change: a director, or for a re-delegation the parent
 * delegation's delegate. Each signed grant is single-use, so an authorization
 * cannot be copied onto another record or replayed to undo a later change.
 * Governed records are never deleted, rolled back or edited field by field;
 * they are revoked, and revoking or narrowing one revokes what was handed on
 * from it.
 *
 * Copies of these records in other vaults carry no authority (verifiers only
 * read the company's own vault) and pass through untouched.
 */
export class DelegationWriteGuard {
    constructor(
        private db: DbService,
        private verify: VerifySignature,
    ) {}

    /** Call before any create or update of a whole MetaEnvelope. */
    async beforeWrite(
        eName: string,
        write: IntendedWrite,
    ): Promise<GuardTicket> {
        const previous = write.id ? await this.load(write.id, eName) : null;
        const next = { ontology: write.ontology, parsed: write.payload ?? {} };

        const wasGoverned = previous ? this.governs(eName, previous) : false;
        const isGoverned = this.governs(eName, next);
        if (!wasGoverned && !isGoverned) return UNGOVERNED;

        if (previous && wasGoverned && previous.ontology !== next.ontology) {
            throw new DelegationWriteError(
                "IMMUTABLE",
                "a governed record cannot change ontology",
            );
        }
        if (wasGoverned && !isGoverned) {
            throw new DelegationWriteError(
                "IMMUTABLE",
                "a governed record cannot leave the company",
            );
        }
        if (
            previous &&
            canonicalJson(previous.parsed) === canonicalJson(next.parsed)
        ) {
            // An identical re-send (e.g. a retry) changes nothing.
            return { governed: true, previous, next };
        }

        const signer = await this.checkSignature(eName, next);
        switch (next.ontology) {
            case COMPANY_ONTOLOGY:
                await this.checkCompany(eName, previous, next.parsed, signer);
                break;
            case ROLE_ONTOLOGY:
                await this.checkRole(eName, previous, next.parsed, signer);
                break;
            case DELEGATION_ONTOLOGY:
                await this.checkDelegation(
                    eName,
                    previous,
                    next.parsed,
                    signer,
                );
                break;
            case SHAREHOLDING_ONTOLOGY:
                await this.requireDirector(eName, signer);
                break;
        }

        const claimToken = await this.claimGrant(
            eName,
            next.parsed.authorization.signedPayload,
            previous?.id ?? null,
        );
        return { governed: true, claimToken, previous, next };
    }

    /** Call once the write landed, with the id it landed under. */
    async afterWrite(
        eName: string,
        ticket: GuardTicket,
        id: string,
        awareness?: AwarenessWriteContext,
    ): Promise<void> {
        if (!ticket.governed || !ticket.next) return;
        if (ticket.claimToken) await this.bindGrant(ticket.claimToken, id);
        const signer = ticket.next.parsed.authorization?.signerEName ?? null;
        if (
            ticket.next.ontology === ROLE_ONTOLOGY ||
            ticket.next.ontology === DELEGATION_ONTOLOGY
        ) {
            await this.cascade(eName, id, signer, awareness);
        }
    }

    /** Call if the write failed, so the signed grant can be used again. */
    async abortWrite(ticket: GuardTicket): Promise<void> {
        if (!ticket.claimToken) return;
        await this.db.runQuery(
            `MATCH (g:DelegationGrant { claimToken: $token })
             WHERE g.metaEnvelopeId IS NULL
             DELETE g`,
            { token: ticket.claimToken },
        );
    }

    /** Deletes, rollbacks and single-field edits are refused on governed records. */
    async assertNotGoverned(
        eName: string,
        id: string,
        action: string,
    ): Promise<void> {
        const existing = await this.load(id, eName);
        if (existing && this.governs(eName, existing)) {
            throw new DelegationWriteError(
                "IMMUTABLE",
                `${action} is not allowed on company authority records; revoke it instead`,
            );
        }
    }

    // ------------------------------------------------------------------

    private governs(
        eName: string,
        record: { ontology: string; parsed: Record_ },
    ): boolean {
        const r = record.parsed ?? {};
        switch (record.ontology) {
            case COMPANY_ONTOLOGY:
                return r.eName === eName && r.directors !== undefined;
            case ROLE_ONTOLOGY:
            case DELEGATION_ONTOLOGY:
            case SHAREHOLDING_ONTOLOGY:
                return r.companyEName === eName;
            default:
                return false;
        }
    }

    private async checkSignature(
        eName: string,
        next: { ontology: string; parsed: Record_ },
    ): Promise<string> {
        if (!next.parsed.authorization) {
            throw new DelegationWriteError(
                "UNSIGNED",
                "company authority records must carry an authorization",
            );
        }
        const problem = await checkGrantAuthorization(
            next.ontology,
            eName,
            next.parsed,
            this.verify,
        );
        if (problem) {
            throw new DelegationWriteError(
                "BAD_AUTHORIZATION",
                `authorization rejected: ${problem.code}`,
            );
        }
        return next.parsed.authorization.signerEName;
    }

    private async checkCompany(
        eName: string,
        previous: Existing | null,
        next: Record_,
        signer: string,
    ): Promise<void> {
        const directors = next.directors;
        if (!Array.isArray(directors) || directors.length === 0) {
            throw new DelegationWriteError(
                "INVALID_RECORD",
                "a company needs at least one director",
            );
        }
        const current = await this.governingCompany(eName);
        if (current && current.id !== previous?.id) {
            throw new DelegationWriteError(
                "COMPANY_EXISTS",
                "this eVault already has a company with directors",
            );
        }
        // Changing the board takes an existing director; the first board is
        // set by its own first director, the creator.
        const entitled = current
            ? (current.parsed.directors as string[])
            : directors;
        if (!entitled.includes(signer)) {
            throw new DelegationWriteError(
                "NOT_AUTHORIZED",
                current
                    ? "only an existing director may change the company"
                    : "the creator must be one of the directors",
            );
        }
    }

    private async checkRole(
        eName: string,
        previous: Existing | null,
        next: Record_,
        signer: string,
    ): Promise<void> {
        await this.requireDirector(eName, signer);
        this.requireScopes(next.scopes);
        if (previous) {
            this.requireLive(previous.parsed);
            this.requireUnchanged(previous.parsed, next, [
                "companyEName",
                "createdBy",
            ]);
            this.requireRevocationBy(next, signer);
        } else {
            this.requireActive(next);
            if (next.createdBy !== signer) {
                throw new DelegationWriteError(
                    "INVALID_RECORD",
                    "createdBy must be the signing director",
                );
            }
        }
    }

    private async checkDelegation(
        eName: string,
        previous: Existing | null,
        next: Record_,
        signer: string,
    ): Promise<void> {
        this.requireScopes(next.scopes);
        const hasRole = typeof next.roleId === "string" && next.roleId !== "";
        const hasParent =
            typeof next.parentDelegationId === "string" &&
            next.parentDelegationId !== "";
        if (hasRole === hasParent) {
            throw new DelegationWriteError(
                "INVALID_RECORD",
                "a delegation needs exactly one of roleId or parentDelegationId",
            );
        }

        if (previous) {
            this.requireLive(previous.parsed);
            this.requireUnchanged(previous.parsed, next, [
                "companyEName",
                "delegateEName",
                "roleId",
                "parentDelegationId",
                "grantedBy",
            ]);
            if (next.status === "revoked") {
                // Revoking takes a director or whoever granted it.
                this.requireRevocationBy(next, signer);
                if (signer !== previous.parsed.grantedBy) {
                    await this.requireDirector(eName, signer);
                }
                return;
            }
        } else {
            this.requireActive(next);
        }

        if (next.grantedBy !== signer) {
            throw new DelegationWriteError(
                "INVALID_RECORD",
                "grantedBy must be the signer",
            );
        }

        if (hasRole) {
            await this.requireDirector(eName, signer);
            const role = await this.load(next.roleId, eName);
            if (!role || role.ontology !== ROLE_ONTOLOGY) {
                throw new DelegationWriteError(
                    "INVALID_RECORD",
                    "role not found in this eVault",
                );
            }
            const r = role.parsed as RoleRecord;
            if (r.companyEName !== eName || r.status !== "active") {
                throw new DelegationWriteError(
                    "INVALID_RECORD",
                    "role is not active for this company",
                );
            }
            this.requireNarrowing(next, r, r.mayRedelegate, "role");
            return;
        }

        const parentId = next.parentDelegationId as string;
        const chain = await evaluateDelegation(
            parentId,
            this.chainSource(eName),
        );
        if (!chain.ok) {
            throw new DelegationWriteError(
                "INVALID_RECORD",
                `parent delegation is not usable: ${chain.code}`,
            );
        }
        const parent = (await this.load(parentId, eName))
            ?.parsed as DelegationRecord;
        if (signer !== parent.delegateEName) {
            throw new DelegationWriteError(
                "NOT_AUTHORIZED",
                "only the parent's delegate may re-delegate it",
            );
        }
        if (!parent.mayRedelegate) {
            throw new DelegationWriteError(
                "NOT_AUTHORIZED",
                "the parent does not allow re-delegation",
            );
        }
        this.requireNarrowing(next, parent, parent.mayRedelegate, "parent");
    }

    private requireNarrowing(
        next: Record_,
        parent: {
            scopes: string[];
            validFrom?: string | null;
            validUntil?: string | null;
            status: "active" | "revoked";
        },
        parentMayRedelegate: boolean,
        what: string,
    ): void {
        if (!isScopeSubset(next.scopes, parent.scopes)) {
            throw new DelegationWriteError(
                "INVALID_RECORD",
                `scopes exceed the ${what}`,
            );
        }
        if (!isWindowWithin(next as DelegationRecord, parent)) {
            throw new DelegationWriteError(
                "INVALID_RECORD",
                `validity extends beyond the ${what}`,
            );
        }
        if (next.mayRedelegate && !parentMayRedelegate) {
            throw new DelegationWriteError(
                "INVALID_RECORD",
                `the ${what} does not allow re-delegation`,
            );
        }
    }

    private requireScopes(scopes: unknown): void {
        const problem = checkScopes(scopes);
        if (problem) {
            throw new DelegationWriteError(
                "INVALID_RECORD",
                `bad scopes: ${problem.code}`,
            );
        }
    }

    private requireActive(next: Record_): void {
        if (next.status !== "active") {
            throw new DelegationWriteError(
                "INVALID_RECORD",
                "a new record must be active",
            );
        }
    }

    /** Revocation is final. */
    private requireLive(previous: Record_): void {
        if (previous.status === "revoked") {
            throw new DelegationWriteError(
                "IMMUTABLE",
                "a revoked record cannot be changed",
            );
        }
    }

    private requireRevocationBy(next: Record_, signer: string): void {
        if (next.status === "revoked" && next.revokedBy !== signer) {
            throw new DelegationWriteError(
                "INVALID_RECORD",
                "revokedBy must be the signer",
            );
        }
    }

    private requireUnchanged(
        previous: Record_,
        next: Record_,
        fields: string[],
    ): void {
        for (const field of fields) {
            if (canonicalJson(previous[field]) !== canonicalJson(next[field])) {
                throw new DelegationWriteError(
                    "IMMUTABLE",
                    `${field} cannot change`,
                );
            }
        }
    }

    private async requireDirector(
        eName: string,
        signer: string,
    ): Promise<void> {
        const company = await this.governingCompany(eName);
        if (!company) {
            throw new DelegationWriteError(
                "NO_COMPANY",
                "this eVault has no company with directors",
            );
        }
        if (!(company.parsed.directors as string[]).includes(signer)) {
            throw new DelegationWriteError(
                "NOT_AUTHORIZED",
                "only a director may do this",
            );
        }
    }

    /** The one Company record in the vault that carries directors. */
    private async governingCompany(eName: string): Promise<Existing | null> {
        const companies = await this.db.findMetaEnvelopesByOntology(
            COMPANY_ONTOLOGY,
            eName,
        );
        const found = companies.find(
            (c) =>
                c.parsed?.eName === eName && Array.isArray(c.parsed?.directors),
        );
        return found
            ? { id: found.id, ontology: found.ontology, parsed: found.parsed }
            : null;
    }

    private chainSource(eName: string) {
        return {
            role: async (id: string) => {
                const r = await this.load(id, eName);
                return r?.ontology === ROLE_ONTOLOGY
                    ? (r.parsed as RoleRecord)
                    : null;
            },
            delegation: async (id: string) => {
                const r = await this.load(id, eName);
                return r?.ontology === DELEGATION_ONTOLOGY
                    ? (r.parsed as DelegationRecord)
                    : null;
            },
        };
    }

    private async load(id: string, eName: string): Promise<Existing | null> {
        const found = await this.db.findMetaEnvelopeById(id, eName);
        return found
            ? { id: found.id, ontology: found.ontology, parsed: found.parsed }
            : null;
    }

    // ---- single-use grants -------------------------------------------

    /**
     * Claims a signed grant for one record. A grant already claimed by any
     * record, even the same one, is a replay: the guard lets identical
     * re-sends through before reaching here, so a claimed grant can only be
     * an older state being written back or a copy onto another record.
     */
    private async claimGrant(
        eName: string,
        signedPayload: string,
        metaEnvelopeId: string | null,
    ): Promise<string> {
        const token = randomUUID();
        const result = await this.db.runQuery(
            `MERGE (g:DelegationGrant { eName: $eName, payloadSha256: $hash })
             ON CREATE SET g.claimToken = $token, g.metaEnvelopeId = $id, g.createdAt = $now
             RETURN g.claimToken = $token AS claimed`,
            {
                eName,
                hash: createHash("sha256").update(signedPayload).digest("hex"),
                token,
                id: metaEnvelopeId,
                now: Date.now(),
            },
        );
        if (result.records[0]?.get("claimed") !== true) {
            throw new DelegationWriteError(
                "REPLAYED_GRANT",
                "this authorization has already been used",
            );
        }
        return token;
    }

    private async bindGrant(token: string, id: string): Promise<void> {
        await this.db.runQuery(
            `MATCH (g:DelegationGrant { claimToken: $token })
             SET g.metaEnvelopeId = $id`,
            { token, id },
        );
    }

    // ---- cascade -----------------------------------------------------

    /**
     * Revokes every live delegation handed on from a role or delegation that
     * no longer covers it: because the parent was revoked, or because it was
     * narrowed below the child's scopes, window or re-delegation right. Each
     * revoked child cascades in turn.
     */
    private async cascade(
        eName: string,
        parentId: string,
        revokedBy: string | null,
        awareness?: AwarenessWriteContext,
    ): Promise<void> {
        const queue = [parentId];
        const seen = new Set<string>();
        while (queue.length > 0) {
            const id = queue.shift() as string;
            if (seen.has(id)) continue;
            seen.add(id);

            const parent = await this.load(id, eName);
            if (!parent) continue;
            const p = parent.parsed;
            const isRole = parent.ontology === ROLE_ONTOLOGY;

            for (const childId of await this.childrenOf(eName, id, isRole)) {
                const child = await this.load(childId, eName);
                if (!child || child.parsed.status !== "active") continue;
                const c = child.parsed;
                const stillCovered =
                    p.status === "active" &&
                    isScopeSubset(c.scopes, p.scopes) &&
                    isWindowWithin(c as DelegationRecord, p as RoleRecord) &&
                    (isRole
                        ? !c.mayRedelegate || p.mayRedelegate
                        : p.mayRedelegate);
                if (stillCovered) continue;

                const now = new Date().toISOString();
                const existing = await this.db.findMetaEnvelopeById(
                    childId,
                    eName,
                );
                await this.db.updateMetaEnvelopeById(
                    childId,
                    {
                        ontology: DELEGATION_ONTOLOGY,
                        payload: {
                            ...c,
                            status: "revoked",
                            revokedAt: now,
                            revokedBy: revokedBy ?? c.grantedBy,
                            revocationReason: "cascade",
                            updatedAt: now,
                        },
                        acl: existing?.acl ?? ["*"],
                        _acl: existing?._acl,
                    },
                    existing?.acl ?? ["*"],
                    eName,
                    awareness,
                );
                queue.push(childId);
            }
        }
    }

    private async childrenOf(
        eName: string,
        parentId: string,
        parentIsRole: boolean,
    ): Promise<string[]> {
        const result = await this.db.runQuery(
            `MATCH (m:MetaEnvelope { eName: $eName, ontology: $ontology })-[:LINKS_TO]->(e:Envelope { ontology: $field })
             WHERE e.value = $parentId
             RETURN m.id AS id`,
            {
                eName,
                ontology: DELEGATION_ONTOLOGY,
                field: parentIsRole ? "roleId" : "parentDelegationId",
                parentId,
            },
        );
        return result.records.map((r) => r.get("id"));
    }
}
