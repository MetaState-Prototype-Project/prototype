import { canonicalJson } from "./canonical";
import {
    type ChainResult,
    type ChainSource,
    type DelegationRecord,
    evaluateDelegation,
    type RoleRecord,
} from "./chain";
import {
    COMPANY_ONTOLOGY,
    DELEGATION_ONTOLOGY,
    ROLE_ONTOLOGY,
} from "./ontologies";
import { checkGrantAuthorization, type VerifySignature } from "./payloads";

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

/** Builds the board's timeline from the Company record's history. */
export async function resolveBoard(
    companyId: string,
    companyEName: string,
    source: HistorySource,
    verify: VerifySignature,
): Promise<BoardTimeline> {
    const timeline: BoardTimeline = [];
    let board: string[] | null = null;
    let lastSignedAt = Number.NEGATIVE_INFINITY;

    for (const v of await source.versions(companyId)) {
        const p = v.parsed;
        if (v.operation === "delete" || !p || v.ontology !== COMPANY_ONTOLOGY) {
            continue;
        }
        if (p.eName !== companyEName || !isENameList(p.directors)) continue;
        const signed = await validGrant(
            COMPANY_ONTOLOGY,
            companyEName,
            companyId,
            p,
            verify,
            lastSignedAt,
        );
        if (!signed) continue;

        // The first board is set by one of its own directors; after that only
        // a sitting director may change it.
        const entitled: string[] = board ?? p.directors;
        if (!entitled.includes(signed.signer)) continue;

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
 * a director for a role or a role assignment, the parent's delegate for a
 * re-delegation, and a director or the grantor to revoke. Grants outlive a
 * director's later removal. Revocation is final.
 */
export function historyChainSource(ctx: HistoryContext): ChainSource {
    const roles = new Map<string, Promise<RoleRecord | null>>();
    const delegations = new Map<string, Promise<DelegationRecord | null>>();
    const resolving = new Set<string>();

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
        delegation(id) {
            // A parent chain that loops back resolves to nothing, rather than
            // waiting on its own pending result.
            if (resolving.has(id)) return Promise.resolve(null);
            if (!delegations.has(id)) {
                resolving.add(id);
                delegations.set(
                    id,
                    (async () => {
                        try {
                            return (await resolveRecord(
                                id,
                                DELEGATION_ONTOLOGY,
                                DELEGATION_IMMUTABLE,
                                ctx,
                                async (p, state, signer, at) => {
                                    const directors = boardAt(ctx.board, at);
                                    if (p.status === "revoked") {
                                        const grantor =
                                            state?.grantedBy ?? p.grantedBy;
                                        return (
                                            revokedBySigner(p, signer) &&
                                            (directors.includes(signer) ||
                                                signer === grantor)
                                        );
                                    }
                                    if (p.grantedBy !== signer) return false;
                                    if (typeof p.roleId === "string") {
                                        return directors.includes(signer);
                                    }
                                    if (
                                        typeof p.parentDelegationId === "string"
                                    ) {
                                        const parent = await source.delegation(
                                            p.parentDelegationId,
                                        );
                                        return parent?.delegateEName === signer;
                                    }
                                    return false;
                                },
                            )) as DelegationRecord | null;
                        } finally {
                            resolving.delete(id);
                        }
                    })(),
                );
            }
            return delegations.get(id) as Promise<DelegationRecord | null>;
        },
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
    }
    return state;
}

/**
 * A version's grant is valid if it is signed for this record and is not older
 * than the last valid version, so an earlier state cannot be written back.
 */
async function validGrant(
    ontology: string,
    companyEName: string,
    id: string,
    record: Record<string, any>,
    verify: VerifySignature,
    lastSignedAt: number,
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
