import { canonicalJson } from "./canonical";
import {
    type ChainResult,
    type ChainSource,
    type DelegationRecord,
    evaluateDelegation,
    MAX_CHAIN_DEPTH,
    type RoleRecord,
} from "./chain";
import {
    COMPANY_ONTOLOGY,
    DELEGATION_ONTOLOGY,
    ROLE_ONTOLOGY,
} from "./ontologies";
import { checkGrantAuthorization, type VerifySignature } from "./payloads";
import { isScopeSubset, type Scope } from "./scopes";

/**
 * One version of a MetaEnvelope as the eVault's `metaEnvelopeHistory` returns
 * it. `createdAt` is when the eVault stored the version.
 */
export type Version = {
    version: number;
    operation: "create" | "update" | "delete";
    ontology: string;
    parsed: Record<string, any> | null;
    createdAt: string;
};

/** Reads a record's versions from the company's eVault, oldest first. */
export interface HistorySource {
    versions(id: string): Promise<Version[]>;
}

/** Who the directors were, from each point in time on. */
export type BoardTimeline = { from: number; directors: string[] }[];

/**
 * The eVault is a plain store: anyone able to write to it can write anything.
 * Authority is therefore read from history, keeping only versions that carry
 * a valid grant from someone entitled to make them. Everything else, whether
 * a forged write, a copy from another record or an older signed state written
 * back, is skipped as if it were never there.
 */

/**
 * Builds the board's timeline from the Company record's history.
 *
 * A board exists only if the record was born with one: its very first version
 * must carry a board signed by one of its own directors. A Company record that
 * started without directors can never acquire a board, so an existing company
 * cannot be claimed by whoever adds directors to it first.
 */
export async function resolveBoard(
    companyId: string,
    companyEName: string,
    source: HistorySource,
    verify: VerifySignature,
): Promise<BoardTimeline> {
    const timeline: BoardTimeline = [];
    let board: string[] | null = null;
    let lastSignedAt = Number.NEGATIVE_INFINITY;

    const versions = await source.versions(companyId);
    for (const [index, v] of versions.entries()) {
        const p = v.parsed;
        const isBoard =
            v.operation !== "delete" &&
            !!p &&
            v.ontology === COMPANY_ONTOLOGY &&
            p.eName === companyEName &&
            isENameList(p.directors);
        if (!isBoard) {
            if (index === 0) return timeline;
            continue;
        }
        const signed = await validGrant(
            COMPANY_ONTOLOGY,
            companyEName,
            companyId,
            p,
            verify,
            lastSignedAt,
            v.createdAt,
        );
        // The first board is set by one of its own directors; after that only
        // a sitting director may change it.
        const entitled: string[] = board ?? p.directors;
        if (!signed || !entitled.includes(signed.signer)) {
            if (index === 0) return timeline;
            continue;
        }

        lastSignedAt = signed.signedAt;
        if (board && canonicalJson(board) === canonicalJson(p.directors))
            continue;
        board = p.directors as string[];
        timeline.push({ from: Date.parse(v.createdAt), directors: board });
    }
    return timeline;
}

/** The directors at a point in time; none before the first board. */
export function boardAt(timeline: BoardTimeline, at: number): string[] {
    let directors: string[] = [];
    for (const entry of timeline) {
        if (entry.from <= at) directors = entry.directors;
        else break;
    }
    return directors;
}

export type HistoryContext = {
    companyEName: string;
    board: BoardTimeline;
    source: HistorySource;
    verify: VerifySignature;
};

const ROLE_IMMUTABLE = ["companyEName", "createdBy"];
const DELEGATION_IMMUTABLE = [
    "companyEName",
    "delegateEName",
    "roleId",
    "parentDelegationId",
    "grantedBy",
];

/**
 * Resolves Roles and Delegations from history and feeds them to the chain
 * evaluator. A signer must have been entitled when their version was stored:
 * a director for a role or a role assignment (from a role not yet revoked),
 * the delegate of a not-yet-revoked parent for a re-delegation, and a director
 * or a still-entitled grantor to revoke. Grants outlive their grantor's later
 * removal or revocation; anything signed after it does not count. Revocation
 * is final. Each record carries `meta` with its trusted grant and revoke times.
 *
 * A source is a snapshot for one verification: it caches what it reads and
 * never re-reads history, so build a new one per verification (as
 * `evaluateFromHistory` does) or a later revocation will not be seen.
 */
export function historyChainSource(ctx: HistoryContext): ChainSource {
    const roles = new Map<string, Promise<RoleRecord | null>>();
    const delegations = new Map<string, DelegationRecord | null>();

    // Cycles are detected along the current lookup path; only settled results
    // are shared, so concurrent lookups never wait on each other.
    const resolveDelegation = async (
        id: string,
        path: ReadonlySet<string>,
    ): Promise<DelegationRecord | null> => {
        // A loop, or a chain past the evaluator's depth limit, resolves to
        // nothing before any more history is read.
        if (path.has(id) || path.size >= MAX_CHAIN_DEPTH) return null;
        if (delegations.has(id)) return delegations.get(id) ?? null;
        const inner = new Set(path).add(id);
        const resolved = (await resolveRecord(
            id,
            DELEGATION_ONTOLOGY,
            DELEGATION_IMMUTABLE,
            ctx,
            async (p, state, signer, at) => {
                const directors = boardAt(ctx.board, at);
                // Whether the grantor of this record still held their
                // authority at that moment: a sitting director for a role
                // assignment, a live parent for a re-delegation. A grant must
                // also fit what its source held then, so widening the source
                // later can never wake up a grant that was too wide.
                const grantorLive = async (
                    rec: Record<string, any>,
                    isGrant: boolean,
                ) => {
                    const fits = (
                        source: {
                            scopes: Scope[];
                            mayRedelegate: boolean;
                        } | null,
                        needsRedelegate: boolean,
                    ) =>
                        !isGrant ||
                        (!!source &&
                            Array.isArray(rec.scopes) &&
                            isScopeSubset(rec.scopes, source.scopes) &&
                            (!needsRedelegate || source.mayRedelegate));
                    if (typeof rec.roleId === "string") {
                        const role = await source.role(rec.roleId);
                        return (
                            directors.includes(rec.grantedBy) &&
                            liveAt(role, at) &&
                            fits(stateAt(role, at), rec.mayRedelegate === true)
                        );
                    }
                    if (typeof rec.parentDelegationId === "string") {
                        const parent = await resolveDelegation(
                            rec.parentDelegationId,
                            inner,
                        );
                        return (
                            parent?.delegateEName === rec.grantedBy &&
                            liveAt(parent, at) &&
                            fits(stateAt(parent, at), true)
                        );
                    }
                    return false;
                };
                if (p.status === "revoked") {
                    // Revoking needs something valid to revoke, and a
                    // director or a grantor who has not been revoked since.
                    if (!state) return false;
                    if (!revokedBySigner(p, signer)) return false;
                    if (directors.includes(signer)) return true;
                    return (
                        signer === state.grantedBy &&
                        (await grantorLive(state, false))
                    );
                }
                if (p.grantedBy !== signer) return false;
                return grantorLive(p, true);
            },
        )) as DelegationRecord | null;
        delegations.set(id, resolved);
        return resolved;
    };

    const source: ChainSource = {
        role(id) {
            if (!roles.has(id)) {
                roles.set(
                    id,
                    resolveRecord(
                        id,
                        ROLE_ONTOLOGY,
                        ROLE_IMMUTABLE,
                        ctx,
                        async (p, state, signer, at) => {
                            if (!boardAt(ctx.board, at).includes(signer))
                                return false;
                            if (!state && p.createdBy !== signer) return false;
                            return revokedBySigner(p, signer);
                        },
                    ) as Promise<RoleRecord | null>,
                );
            }
            return roles.get(id) as Promise<RoleRecord | null>;
        },
        delegation: (id) => resolveDelegation(id, new Set()),
    };
    return source;
}

/**
 * Verifies a delegation for a company straight from its eVault history: the
 * board from the Company record (the eVault's manifest), then the chain.
 */
export async function evaluateFromHistory(input: {
    delegationId: string;
    companyEName: string;
    companyId: string;
    source: HistorySource;
    verify: VerifySignature;
    now?: Date;
}): Promise<ChainResult> {
    const board = await resolveBoard(
        input.companyId,
        input.companyEName,
        input.source,
        input.verify,
    );
    return evaluateDelegation(
        input.delegationId,
        historyChainSource({
            companyEName: input.companyEName,
            board,
            source: input.source,
            verify: input.verify,
        }),
        { now: input.now },
    );
}

type Entitled = (
    next: Record<string, any>,
    state: Record<string, any> | null,
    signer: string,
    at: number,
) => Promise<boolean>;

/** The latest valid state of a record, or null if it never had one. */
async function resolveRecord(
    id: string,
    ontology: string,
    immutable: string[],
    ctx: HistoryContext,
    entitled: Entitled,
): Promise<Record<string, any> | null> {
    let state: Record<string, any> | null = null;
    let lastSignedAt = Number.NEGATIVE_INFINITY;
    // Storage times of the first valid grant and of a valid revocation: the
    // eVault's clock, which no signer controls.
    let grantedAt: number | undefined;
    let revokedAt: number | undefined;
    const timeline: {
        at: number;
        status: string;
        scopes: Scope[];
        mayRedelegate: boolean;
    }[] = [];

    for (const v of await ctx.source.versions(id)) {
        if (state?.status === "revoked") break;
        const p = v.parsed;
        if (v.operation === "delete" || !p || v.ontology !== ontology) continue;
        if (p.companyEName !== ctx.companyEName) continue;
        const signed = await validGrant(
            ontology,
            ctx.companyEName,
            id,
            p,
            ctx.verify,
            lastSignedAt,
            v.createdAt,
        );
        if (!signed) continue;
        if (
            state &&
            immutable.some(
                (f) => canonicalJson(state?.[f]) !== canonicalJson(p[f]),
            )
        ) {
            continue;
        }
        if (
            !(await entitled(p, state, signed.signer, Date.parse(v.createdAt)))
        ) {
            continue;
        }
        state = p;
        lastSignedAt = signed.signedAt;
        const storedAt = Date.parse(v.createdAt);
        grantedAt ??= storedAt;
        if (p.status === "revoked") revokedAt = storedAt;
        timeline.push({
            at: storedAt,
            status: String(p.status),
            scopes: Array.isArray(p.scopes) ? p.scopes : [],
            mayRedelegate: p.mayRedelegate === true,
        });
    }
    if (!state) return null;
    return {
        ...state,
        meta: {
            grantedAt,
            revokedAt,
            // A malformed flag counts as a cascade, so it fails closed.
            cascade:
                revokedAt !== undefined &&
                state.revocationCascade !== undefined &&
                state.revocationCascade !== null &&
                state.revocationCascade !== false,
            timeline,
        },
    };
}

/** A record's scopes and re-delegation right as they stood at a moment. */
function stateAt(
    record: {
        meta?: {
            timeline?: {
                at: number;
                scopes: Scope[];
                mayRedelegate: boolean;
            }[];
        };
    } | null,
    at: number,
): { scopes: Scope[]; mayRedelegate: boolean } | null {
    let found: { scopes: Scope[]; mayRedelegate: boolean } | null = null;
    for (const entry of record?.meta?.timeline ?? []) {
        if (entry.at <= at) found = entry;
        else break;
    }
    return found;
}

/** Whether a record still carried authority at a moment of the eVault's clock. */
function liveAt(
    record: {
        status?: string;
        meta?: { timeline?: { at: number; status: string }[] };
    } | null,
    at: number,
): boolean {
    if (!record) return false;
    // Live means active at that moment: not yet revoked, and not in some
    // other status it may have passed through.
    let status: string | undefined;
    for (const entry of record.meta?.timeline ?? []) {
        if (entry.at <= at) status = entry.status;
        else break;
    }
    return status === "active";
}

/** How far a signer's clock may run ahead of the eVault's. */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * A version's grant is valid if it is signed for this record, is not older
 * than the last valid version (so an earlier state cannot be written back),
 * and was not dated after the eVault stored it (so a signer cannot postdate a
 * version to make every later change look older).
 */
async function validGrant(
    ontology: string,
    companyEName: string,
    id: string,
    record: Record<string, any>,
    verify: VerifySignature,
    lastSignedAt: number,
    storedAt: string,
): Promise<{ signer: string; signedAt: number } | null> {
    if (
        await checkGrantAuthorization(
            ontology,
            companyEName,
            id,
            record,
            verify,
        )
    ) {
        return null;
    }
    const signedAt = Date.parse(record.authorization.signedAt);
    if (signedAt < lastSignedAt) return null;
    if (signedAt > Date.parse(storedAt) + MAX_CLOCK_SKEW_MS) return null;
    return { signer: record.authorization.signerEName, signedAt };
}

function revokedBySigner(p: Record<string, any>, signer: string): boolean {
    return p.status !== "revoked" || p.revokedBy === signer;
}

function isENameList(value: unknown): value is string[] {
    return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((v) => typeof v === "string" && /^@\S+$/.test(v))
    );
}
