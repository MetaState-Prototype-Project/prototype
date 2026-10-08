import type { DelegatedSignPayload } from "./payloads";
import {
    checkScopes,
    isCoreScope,
    isScopeSubset,
    normaliseScope,
    type Scope,
} from "./scopes";

type Validity = {
    validFrom?: string | null;
    validUntil?: string | null;
    status: "active" | "revoked";
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
    | "NOT_A_SUBSET"
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
 * lets its delegate sign now. Every link must be live, stay within the
 * company, only narrow its parent, be granted by its parent's delegate, and
 * come from a parent that allows re-delegation.
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
    let id = delegationId;
    let current = leaf;

    for (;;) {
        if (chain.includes(id)) return fail("CYCLE", id, "delegation cycle");
        if (chain.length >= maxDepth) {
            return fail("TOO_DEEP", id, "delegation chain too deep");
        }
        chain.push(id);

        const problem = linkProblem(current, leaf.companyEName, now);
        if (problem) return fail(problem.code, id, problem.message);
        if (current.appLimits) appLimits.unshift(current.appLimits);

        if (current.roleId) {
            const role = await source.role(current.roleId);
            if (!role)
                return fail("NOT_FOUND", current.roleId, "role not found");
            const roleProblem = linkProblem(role, leaf.companyEName, now);
            if (roleProblem) {
                return fail(
                    roleProblem.code,
                    current.roleId,
                    roleProblem.message,
                );
            }
            if (!isScopeSubset(current.scopes, role.scopes)) {
                return fail("NOT_A_SUBSET", id, "scopes exceed the role");
            }
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
                scopes: leaf.scopes.map((s) => normaliseScope(s) as Scope),
                appLimits,
                chain,
                roleId: current.roleId,
            };
        }

        const parentId = current.parentDelegationId as string;
        const parent = await source.delegation(parentId);
        if (!parent) return fail("NOT_FOUND", parentId, "parent not found");
        if (!parent.mayRedelegate) {
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
        if (!isScopeSubset(current.scopes, parent.scopes)) {
            return fail("NOT_A_SUBSET", id, "scopes exceed the parent");
        }
        id = parentId;
        current = parent;
    }
}

function linkProblem(
    record: (RoleRecord | DelegationRecord) & Validity,
    companyEName: string,
    now: Date,
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
        return { code: "REVOKED", message: "revoked" };
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
