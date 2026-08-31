import {
    type AclBlock,
    type Condition,
    type ConditionEvaluator,
    type ConditionGroup,
    type Decision,
    type EName,
    type Grant,
    Permission,
    type PermissionBits,
    type Principal,
    RESERVED_MASK,
} from "./types";

/** The wildcard used by the legacy `acl: string[]` model. */
export const LEGACY_WILDCARD = "*";

/**
 * A `require` holding one empty group. An AND over zero conditions is
 * vacuously true, so every principal reaches `default_perms`. This is how the
 * legacy `["*"]` ACL is expressed in the new model.
 */
const OPEN_REQUIREMENT: ConditionGroup[] = [[]];

/** Drops reserved bits from stored data, which we accept liberally. */
export function sanitizePerms(perms: unknown): PermissionBits {
    if (typeof perms !== "number" || !Number.isInteger(perms))
        return Permission.NONE;
    return perms & ~RESERVED_MASK;
}

/**
 * Validates permission bits arriving from a caller. Reserved bits MUST be zero
 * at version 1, so a write that sets them is rejected rather than silently
 * narrowed.
 */
export function validatePerms(perms: unknown): PermissionBits {
    if (
        typeof perms !== "number" ||
        !Number.isInteger(perms) ||
        perms < 0 ||
        perms > 0xff
    ) {
        throw new Error("Invalid ACL permissions: expected an unsigned byte");
    }
    if ((perms & RESERVED_MASK) !== 0) {
        throw new Error(
            "Invalid ACL permissions: bits 4-7 are reserved and must be 0",
        );
    }
    return perms;
}

/** An empty policy: nothing named, nothing admitted. */
export function emptyAclBlock(): AclBlock {
    return {
        v: 1,
        grants: [],
        denials: { enames: [], conditions: [] },
        default_perms: Permission.NONE,
        require: [],
    };
}

function isOperator(op: unknown): op is Condition["op"] {
    return (
        op === ">=" || op === ">" || op === "<=" || op === "<" || op === "=="
    );
}

function normalizeCondition(raw: unknown): Condition | null {
    if (typeof raw !== "object" || raw === null) return null;
    const c = raw as Record<string, unknown>;
    if (typeof c.ontology !== "string" || typeof c.path !== "string")
        return null;
    if (!isOperator(c.op)) return null;
    if (typeof c.value !== "number" || !Number.isFinite(c.value)) return null;
    return { ontology: c.ontology, path: c.path, op: c.op, value: c.value };
}

function normalizeConditions(raw: unknown): Condition[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map(normalizeCondition)
        .filter((c): c is Condition => c !== null);
}

/**
 * Coerces stored or caller-supplied data into a well-formed {@link AclBlock}.
 * Malformed entries are dropped rather than trusted — an unparseable grant must
 * never widen access.
 */
export function normalizeAclBlock(raw: unknown): AclBlock {
    if (typeof raw !== "object" || raw === null) return emptyAclBlock();
    const block = raw as Record<string, unknown>;

    const grants: Grant[] = Array.isArray(block.grants)
        ? block.grants
              .map((g): Grant | null => {
                  if (typeof g !== "object" || g === null) return null;
                  const entry = g as Record<string, unknown>;
                  if (typeof entry.ename !== "string") return null;
                  const perms = sanitizePerms(entry.perms);
                  // 0x00 is meaningless and is treated as no grant at all.
                  if (perms === Permission.NONE) return null;
                  return { ename: entry.ename, perms };
              })
              .filter((g): g is Grant => g !== null)
        : [];

    const rawDenials =
        typeof block.denials === "object" && block.denials !== null
            ? (block.denials as Record<string, unknown>)
            : {};

    const require: ConditionGroup[] = Array.isArray(block.require)
        ? block.require.filter(Array.isArray).map(normalizeConditions)
        : [];

    return {
        v: 1,
        grants,
        denials: {
            enames: Array.isArray(rawDenials.enames)
                ? rawDenials.enames.filter(
                      (e): e is string => typeof e === "string",
                  )
                : [],
            conditions: normalizeConditions(rawDenials.conditions),
        },
        default_perms: sanitizePerms(block.default_perms),
        require,
    };
}

/**
 * Interprets a legacy `acl: string[]` as an {@link AclBlock}.
 *
 * `"*"` admitted anyone to everything, so it maps to full `default_perms`
 * behind an always-passing requirement. A listed eName was likewise
 * unrestricted, so it maps to a full grant. This keeps every record written
 * before the `_acl` block behaving exactly as it did.
 */
export function fromLegacyAcl(
    acl: readonly string[] | null | undefined,
): AclBlock {
    const block = emptyAclBlock();
    if (!Array.isArray(acl)) return block;

    for (const entry of acl) {
        if (typeof entry !== "string" || entry.length === 0) continue;
        if (entry === LEGACY_WILDCARD) {
            block.default_perms = Permission.ALL;
            block.require = OPEN_REQUIREMENT.map((group) => [...group]);
            continue;
        }
        block.grants.push({ ename: entry, perms: Permission.ALL });
    }
    return block;
}

/**
 * Picks the policy for a record. An explicit `_acl` block always wins; a record
 * carrying only the legacy array is interpreted through {@link fromLegacyAcl}.
 */
export function resolveAclBlock(record: {
    _acl?: unknown;
    acl?: readonly string[] | null;
}): AclBlock {
    if (record._acl !== undefined && record._acl !== null) {
        return normalizeAclBlock(record._acl);
    }
    return fromLegacyAcl(record.acl);
}

/**
 * How specifically a grant's eName matches the principal: a user grant beats a
 * platform grant, which beats a grant to a group the party belongs to. `0`
 * means the grant does not apply.
 */
function specificityOf(ename: EName, principal: Principal): number {
    if (ename === principal.ename) return principal.kind === "user" ? 3 : 2;
    if (principal.platform !== undefined && ename === principal.platform)
        return 2;
    if (principal.groups?.includes(ename)) return 1;
    return 0;
}

/**
 * The single most specific grant applying to `principal`, or `null`.
 *
 * Less specific grants never add to a more specific one. Grants tied at the
 * same specificity — duplicates, or two groups the party belongs to — are
 * unioned, since nothing in the design orders one above the other and picking
 * arbitrarily would make the outcome depend on storage order.
 */
export function mostSpecificGrant(
    grants: readonly Grant[],
    principal: Principal,
): { perms: PermissionBits; enames: EName[] } | null {
    let bestRank = 0;
    let perms: PermissionBits = Permission.NONE;
    let enames: EName[] = [];

    for (const grant of grants) {
        const rank = specificityOf(grant.ename, principal);
        if (rank === 0) continue;
        if (rank > bestRank) {
            bestRank = rank;
            perms = grant.perms;
            enames = [grant.ename];
        } else if (rank === bestRank) {
            perms |= grant.perms;
            enames.push(grant.ename);
        }
    }

    if (bestRank === 0 || perms === Permission.NONE) return null;
    return { perms, enames };
}

/**
 * Every identity a denial by name can match: the party itself, the platform
 * acting for it, and each group it belongs to.
 */
function identitiesOf(principal: Principal): Set<EName> {
    const identities = new Set<EName>([principal.ename]);
    if (principal.platform !== undefined) identities.add(principal.platform);
    for (const group of principal.groups ?? []) identities.add(group);
    return identities;
}

/**
 * A condition with no evaluator wired in cannot be shown to hold, and the
 * design is explicit that an unresolvable condition fails rather than passes.
 */
async function conditionPasses(
    condition: Condition,
    principal: Principal,
    evaluator: ConditionEvaluator | undefined,
): Promise<boolean> {
    if (!evaluator) return false;
    try {
        return await evaluator.passes(condition, principal);
    } catch {
        return false;
    }
}

/** A group passes when every condition in it passes. An empty group is vacuously true. */
async function groupPasses(
    group: ConditionGroup,
    principal: Principal,
    evaluator: ConditionEvaluator | undefined,
): Promise<boolean> {
    for (const condition of group) {
        if (!(await conditionPasses(condition, principal, evaluator)))
            return false;
    }
    return true;
}

/** Rejects an action that is not exactly one permission bit. */
function validateAction(action: PermissionBits): void {
    if (
        !Number.isInteger(action) ||
        action === Permission.NONE ||
        (action & RESERVED_MASK) !== 0 ||
        (action & (action - 1)) !== 0
    ) {
        throw new Error(
            "Invalid ACL action: expected exactly one permission bit",
        );
    }
}

/**
 * Decides whether `principal` may perform `action` under `acl`.
 *
 * The order is fixed: denials, then a direct grant, then the ontology groups.
 * A direct grant is final — a party named in `grants` never falls through to
 * `default_perms`, whether the grant allowed the action or not.
 *
 * `require` is evaluated in order and short-circuits on the first passing group.
 */
export async function evaluate(
    acl: AclBlock,
    principal: Principal,
    action: PermissionBits,
    evaluator?: ConditionEvaluator,
): Promise<Decision> {
    validateAction(action);

    // 1. Denials win over everything, with no exceptions.
    const identities = identitiesOf(principal);
    for (const denied of acl.denials.enames) {
        if (identities.has(denied)) {
            return { allowed: false, reason: "denied_by_ename" };
        }
    }
    for (const condition of acl.denials.conditions) {
        if (!(await conditionPasses(condition, principal, evaluator))) {
            return { allowed: false, reason: "denied_by_condition" };
        }
    }

    // 2. A direct grant decides the outcome on its own.
    const grant = mostSpecificGrant(acl.grants, principal);
    if (grant !== null) {
        return {
            allowed: (grant.perms & action) !== 0,
            reason: "grant",
            perms: grant.perms,
            matchedGrant: grant.enames[0],
        };
    }

    // 3. Otherwise the party must clear one of the ontology groups.
    for (const group of acl.require) {
        if (await groupPasses(group, principal, evaluator)) {
            return {
                allowed: (acl.default_perms & action) !== 0,
                reason: "ontology",
                perms: acl.default_perms,
            };
        }
    }

    return { allowed: false, reason: "no_matching_group" };
}

/**
 * Coerces a caller-supplied policy into a block, or `undefined` when the caller
 * supplied none — which is not the same as an empty policy, and must leave the
 * record on its legacy array rather than locking it.
 *
 * Unlike stored data, caller input is validated strictly: a grant that sets a
 * reserved bit is rejected rather than silently narrowed, so a client writing
 * against a newer version of the spec fails loudly instead of getting weaker
 * permissions than it asked for.
 */
function validateConditionInput(raw: unknown, where: string): void {
    if (typeof raw !== "object" || raw === null) {
        throw new Error(`Invalid _acl: ${where} must be an object`);
    }
    const c = raw as Record<string, unknown>;
    if (typeof c.ontology !== "string" || c.ontology.length === 0) {
        throw new Error(`Invalid _acl: ${where} needs an ontology eName`);
    }
    if (typeof c.path !== "string" || c.path.length === 0) {
        throw new Error(`Invalid _acl: ${where} needs a path`);
    }
    if (!isOperator(c.op)) {
        throw new Error(
            `Invalid _acl: ${where} has an unknown operator ${JSON.stringify(c.op)}; expected one of >=, >, <=, <, ==`,
        );
    }
    if (typeof c.value !== "number" || !Number.isFinite(c.value)) {
        throw new Error(`Invalid _acl: ${where} needs a finite numeric value`);
    }
}

/**
 * Coerces a caller-supplied policy into a block, or `undefined` when the caller
 * supplied none — which is not the same as an empty policy, and must leave the
 * record on its legacy array rather than locking it.
 *
 * Caller input is validated strictly and rejected on anything malformed, while
 * stored data is read liberally. Dropping an entry we cannot parse is safe for
 * a grant but not for a denial: a deny condition silently discarded would
 * *widen* access, and a caller would have no way to tell its policy was not
 * the one being enforced.
 */
export function aclBlockFromInput(raw: unknown): AclBlock | undefined {
    if (raw === null || raw === undefined) return undefined;
    if (typeof raw !== "object" || Array.isArray(raw)) {
        throw new Error("Invalid _acl: expected an object");
    }
    const block = raw as Record<string, unknown>;

    if (block.v !== undefined && block.v !== 1) {
        throw new Error(
            `Unsupported _acl version: ${String(block.v)}; this eVault understands version 1`,
        );
    }

    if (block.grants !== undefined) {
        if (!Array.isArray(block.grants)) {
            throw new Error("Invalid _acl: grants must be an array");
        }
        for (const grant of block.grants) {
            if (typeof grant !== "object" || grant === null) {
                throw new Error("Invalid _acl: each grant must be an object");
            }
            const entry = grant as Record<string, unknown>;
            if (typeof entry.ename !== "string" || entry.ename.length === 0) {
                throw new Error("Invalid _acl: each grant needs an ename");
            }
            validatePerms(entry.perms);
        }
    }

    if (block.denials !== undefined) {
        if (typeof block.denials !== "object" || block.denials === null) {
            throw new Error("Invalid _acl: denials must be an object");
        }
        const denials = block.denials as Record<string, unknown>;
        if (denials.enames !== undefined) {
            if (!Array.isArray(denials.enames)) {
                throw new Error("Invalid _acl: denials.enames must be an array");
            }
            for (const ename of denials.enames) {
                if (typeof ename !== "string" || ename.length === 0) {
                    throw new Error(
                        "Invalid _acl: each denials.enames entry must be a non-empty string",
                    );
                }
            }
        }
        if (denials.conditions !== undefined) {
            if (!Array.isArray(denials.conditions)) {
                throw new Error("Invalid _acl: denials.conditions must be an array");
            }
            denials.conditions.forEach((c, i) =>
                validateConditionInput(c, `denials.conditions[${i}]`),
            );
        }
    }

    if (block.default_perms !== undefined) {
        validatePerms(block.default_perms);
    }

    if (block.require !== undefined) {
        if (!Array.isArray(block.require)) {
            throw new Error("Invalid _acl: require must be an array of groups");
        }
        block.require.forEach((group, g) => {
            if (!Array.isArray(group)) {
                throw new Error(`Invalid _acl: require[${g}] must be an array of conditions`);
            }
            group.forEach((c, i) => validateConditionInput(c, `require[${g}][${i}]`));
        });
    }

    return normalizeAclBlock(raw);
}
