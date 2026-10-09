import type { DelegatedSignPayload } from "./payloads";
import { checkScopes, isCoreScope, normaliseScope, type Scope } from "./scopes";

type Validity = {
    validFrom?: string | null;
    validUntil?: string | null;
    status: "active" | "revoked";
    createdAt?: string;
    revokedAt?: string | null;
    /** Set on a revocation that also revokes everything handed on from it. */
    revocationCascade?: boolean | null;
    /** Trusted timing from the eVault's history, when the source has it. */
    meta?: RecordMeta;
};

/**
 * When a record was first validly granted and validly revoked, by the eVault's
 * own storage clock, and whether that revocation cascades. History-backed
 * sources fill this in; without it the record's own dates are used.
 */
export type RecordMeta = {
    grantedAt?: number;
    revokedAt?: number;
    cascade?: boolean;
    /** Each valid version's scopes and re-delegation right, by storage time. */
    timeline?: {
        at: number;
        status: string;
        scopes: Scope[];
        mayRedelegate: boolean;
    }[];
};

export type RoleRecord = Validity & {
    companyEName: string;
    title: string;
    scopes: Scope[];
    appLimits?: Record<string, unknown>;
    mayRedelegate: boolean;
};

export type DelegationRecord = Validity & {
    companyEName: string;
    delegateEName: string;
    roleId?: string;
    parentDelegationId?: string;
    title: string;
    scopes: Scope[];
    appLimits?: Record<string, unknown>;
    mayRedelegate: boolean;
    grantedBy: string;
};

/** Reads records from the company's eVault. */
export interface ChainSource {
    role(id: string): Promise<RoleRecord | null>;
    delegation(id: string): Promise<DelegationRecord | null>;
}

export type ChainFailureCode =
    | "NOT_FOUND"
    | "REVOKED"
    | "NOT_YET_VALID"
    | "EXPIRED"
    | "MALFORMED"
    | "CORE_SCOPE"
    | "WRONG_COMPANY"
    | "REDELEGATION_NOT_ALLOWED"
    | "WRONG_GRANTOR"
    | "CYCLE"
    | "TOO_DEEP";

export type ChainResult =
    | {
          ok: true;
          companyEName: string;
          delegateEName: string;
          title: string;
          /** What the delegate may sign right now. */
          scopes: Scope[];
          /** Every link's app limits, root first; an app must satisfy all. */
          appLimits: Record<string, unknown>[];
          /** Delegation ids from the one evaluated up to the role assignment. */
          chain: string[];
          roleId: string;
      }
    | { ok: false; code: ChainFailureCode; at: string; message: string };

export const MAX_CHAIN_DEPTH = 16;

/**
 * Whether `[validFrom, validUntil)` covers `now`; null if it does. An
 * unparsable date fails closed rather than comparing as never-expiring.
 */
function windowProblem(
    record: Validity,
    now: Date,
): "NOT_YET_VALID" | "EXPIRED" | "MALFORMED" | null {
    const t = now.getTime();
    const from = record.validFrom ? Date.parse(record.validFrom) : null;
    const until = record.validUntil ? Date.parse(record.validUntil) : null;
    if (Number.isNaN(from) || Number.isNaN(until)) return "MALFORMED";
    if (from !== null && from > t) return "NOT_YET_VALID";
    if (until !== null && until <= t) return "EXPIRED";
    return null;
}

/** Whether a child's validity window lies within its parent's. */
export function isWindowWithin(child: Validity, parent: Validity): boolean {
    const from = (v?: string | null) => (v ? Date.parse(v) : -Infinity);
    const until = (v?: string | null) => (v ? Date.parse(v) : Infinity);
    return (
        from(child.validFrom) >= from(parent.validFrom) &&
        until(child.validUntil) <= until(parent.validUntil)
    );
}

/**
 * Walks a delegation up to the role it ultimately assigns and decides what it
 * lets its delegate sign now. The delegate's own link must be live. Each link
 * above must stay within the company, allow re-delegation, and either be live
 * or have been revoked only after granting what is below it (and without
 * cascading). What can be signed is the intersection of every link's current
 * scopes, so narrowing a parent narrows everything below it.
 *
 * Whether a director was entitled to assign the role is checked when the
 * record is written (the eVault's write guard), not here.
 */
export async function evaluateDelegation(
    delegationId: string,
    source: ChainSource,
    options: { now?: Date; maxDepth?: number } = {},
): Promise<ChainResult> {
    const now = options.now ?? new Date();
    const maxDepth = options.maxDepth ?? MAX_CHAIN_DEPTH;
    const fail = (code: ChainFailureCode, at: string, message: string) =>
        ({ ok: false, code, at, message }) as const;

    const leaf = await source.delegation(delegationId);
    if (!leaf) return fail("NOT_FOUND", delegationId, "delegation not found");

    const chain: string[] = [];
    const appLimits: Record<string, unknown>[] = [];
    // What the signer may sign now: every link's current scopes, intersected,
    // so narrowing anything above shrinks everything below.
    let effective = new Set<string | null>();
    const narrow = (scopes: unknown): boolean => {
        if (!Array.isArray(scopes)) return false;
        const keep = new Set(scopes.map((s) => normaliseScope(s)));
        effective = new Set([...effective].filter((s) => keep.has(s)));
        return true;
    };
    let id = delegationId;
    let current = leaf;

    for (;;) {
        if (chain.includes(id)) return fail("CYCLE", id, "delegation cycle");
        if (chain.length >= maxDepth) {
            return fail("TOO_DEEP", id, "delegation chain too deep");
        }
        chain.push(id);

        // The signer must be live; a revoked link above may still back them.
        const problem = linkProblem(
            current,
            leaf.companyEName,
            now,
            current !== leaf,
        );
        if (problem) return fail(problem.code, id, problem.message);
        // The signer's scopes are only read once they are known to be well formed.
        if (current === leaf) {
            effective = new Set(leaf.scopes.map((s) => normaliseScope(s)));
        }
        if (current.appLimits) appLimits.unshift(current.appLimits);

        if (current.roleId) {
            const role = await source.role(current.roleId);
            if (!role)
                return fail("NOT_FOUND", current.roleId, "role not found");
            const roleProblem = linkProblem(role, leaf.companyEName, now, true);
            if (roleProblem) {
                return fail(
                    roleProblem.code,
                    current.roleId,
                    roleProblem.message,
                );
            }
            if (!stillBacks(role, current)) {
                return fail("REVOKED", current.roleId, "role revoked");
            }
            narrow(role.scopes);
            if (current.mayRedelegate && !role.mayRedelegate) {
                return fail(
                    "REDELEGATION_NOT_ALLOWED",
                    id,
                    "role does not allow re-delegation",
                );
            }
            if (role.appLimits) appLimits.unshift(role.appLimits);
            return {
                ok: true,
                companyEName: leaf.companyEName,
                delegateEName: leaf.delegateEName,
                title: leaf.title,
                scopes: [...effective].filter((s): s is Scope => s !== null),
                appLimits,
                chain,
                roleId: current.roleId,
            };
        }

        const parentId = current.parentDelegationId as string;
        const parent = await source.delegation(parentId);
        if (!parent) return fail("NOT_FOUND", parentId, "parent not found");
        if (parent.status !== "active" && parent.status !== "revoked") {
            return fail(
                "MALFORMED",
                parentId,
                `unknown status ${String(parent.status)}`,
            );
        }
        if (!stillBacks(parent, current)) {
            return fail(
                "REVOKED",
                parentId,
                "revoked before granting, or with everything handed on",
            );
        }
        // A revoked parent that still backs this child is judged as it was
        // when the child was granted (history enforces that); its revocation
        // turning re-delegation off must not cascade.
        if (!parent.mayRedelegate && parent.status !== "revoked") {
            return fail(
                "REDELEGATION_NOT_ALLOWED",
                id,
                "parent does not allow re-delegation",
            );
        }
        if (current.grantedBy !== parent.delegateEName) {
            return fail(
                "WRONG_GRANTOR",
                id,
                "not granted by the parent's delegate",
            );
        }
        if (!narrow(parent.scopes)) {
            return fail("MALFORMED", parentId, "bad scopes");
        }
        id = parentId;
        current = parent;
    }
}

/**
 * Whether a parent still backs a child granted under it. Revoking someone
 * stops only them: what they granted while still valid stands, unless the
 * revocation explicitly cascades to everything handed on.
 */
function stillBacks(parent: Validity, child: Validity): boolean {
    if (parent.status === "active") return true;
    // Only an explicit revocation can still back what it granted before.
    if (parent.status !== "revoked") return false;
    // Anything but an explicit false (or no flag) counts as a cascade, so a
    // malformed flag fails closed.
    const flag = parent.revocationCascade;
    const cascade =
        parent.meta?.cascade ??
        (flag !== undefined && flag !== null && flag !== false);
    if (cascade) return false;
    const revokedAt =
        parent.meta?.revokedAt ??
        (parent.revokedAt ? Date.parse(parent.revokedAt) : Number.NaN);
    const grantedAt =
        child.meta?.grantedAt ??
        (child.createdAt ? Date.parse(child.createdAt) : Number.NaN);
    return (
        Number.isFinite(revokedAt) &&
        Number.isFinite(grantedAt) &&
        grantedAt < revokedAt
    );
}

function linkProblem(
    record: (RoleRecord | DelegationRecord) & Validity,
    companyEName: string,
    now: Date,
    revokedIsJudgedSeparately = false,
): { code: ChainFailureCode; message: string } | null {
    if (record.companyEName !== companyEName) {
        return { code: "WRONG_COMPANY", message: "belongs to another company" };
    }
    if ("delegateEName" in record) {
        const hasRole = typeof record.roleId === "string";
        const hasParent = typeof record.parentDelegationId === "string";
        if (hasRole === hasParent) {
            return {
                code: "MALFORMED",
                message: "needs exactly one of roleId or parentDelegationId",
            };
        }
    }
    if (record.status !== "active") {
        // Only an explicit revocation above the signer is judged separately;
        // any other status fails closed.
        if (record.status !== "revoked") {
            return {
                code: "MALFORMED",
                message: `unknown status ${String(record.status)}`,
            };
        }
        if (!revokedIsJudgedSeparately) {
            return { code: "REVOKED", message: "revoked" };
        }
    }
    const window = windowProblem(record, now);
    if (window) return { code: window, message: window.toLowerCase() };
    const scopes = checkScopes(record.scopes);
    if (scopes) {
        return {
            code: scopes.code === "CORE_SCOPE" ? "CORE_SCOPE" : "MALFORMED",
            message: `bad scopes: ${scopes.code}`,
        };
    }
    return null;
}

export type SignatureProblem =
    | { code: "CHAIN_INVALID"; chain: Extract<ChainResult, { ok: false }> }
    | { code: "WRONG_COMPANY" }
    | { code: "WRONG_SIGNER" }
    | { code: "WRONG_DELEGATION" }
    | { code: "CORE_SCOPE" }
    | { code: "SCOPE_NOT_DELEGATED" };

/**
 * Whether a parsed `w3ds-sign/v1` payload is covered by an evaluated chain.
 * The cryptographic signature itself is checked by the caller.
 */
export function checkDelegatedSignature(
    payload: DelegatedSignPayload,
    chain: ChainResult,
): SignatureProblem | null {
    if (!chain.ok) return { code: "CHAIN_INVALID", chain };
    if (payload.onBehalfOf !== chain.companyEName) {
        return { code: "WRONG_COMPANY" };
    }
    if (payload.signer !== chain.delegateEName) return { code: "WRONG_SIGNER" };
    if (payload.delegationId !== chain.chain[0]) {
        return { code: "WRONG_DELEGATION" };
    }
    if (isCoreScope(payload.scope)) return { code: "CORE_SCOPE" };
    const scope = normaliseScope(payload.scope);
    if (!scope || !chain.scopes.includes(scope)) {
        return { code: "SCOPE_NOT_DELEGATED" };
    }
    return null;
}
