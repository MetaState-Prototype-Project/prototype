/**
 * Access control: granular permissions and the Resource Link Ontology.
 *
 * This module carries the *list* layer of the design: named grants, denials,
 * and the decision order that combines them. Condition evaluation (the
 * Resource Link Ontology — how a platform's score is fetched and compared) is
 * delegated to an injected {@link ConditionEvaluator}. Nothing here resolves a
 * score, reads an ontology, or talks to the network.
 */

/** A party reference, written `@<uuid>`. Identifies a user, platform, group, or ontology. */
export type EName = string;

/** Permission bits. Independent, combined by union. */
export const Permission = {
    NONE: 0x00,
    READ: 0x01,
    CREATE: 0x02,
    UPDATE: 0x04,
    DELETE: 0x08,
    /** Read + Create + Update + Delete. */
    ALL: 0x0f,
} as const;

/** An unsigned byte holding a union of {@link Permission} bits. */
export type PermissionBits = number;

/** Bits 4-7 are reserved and MUST be zero at version 1. */
export const RESERVED_MASK = 0xf0;

/** The only operators defined today. All are numeric. */
export type ComparisonOperator = ">=" | ">" | "<=" | "<" | "==";

/**
 * A numeric requirement on a value found at `path` inside the value described
 * by the ontology `ontology`.
 */
export interface Condition {
    /** The ontology's eName, e.g. eReputation. */
    ontology: EName;
    /** JSONPath into the ontology value, e.g. `$.score`. */
    path: string;
    op: ComparisonOperator;
    value: number;
}

/** All conditions must pass (AND). */
export type ConditionGroup = Condition[];

/** Any group passing is enough (OR). Disjunctive normal form. */
export type Requirement = ConditionGroup[];

/** One named party and the permissions it holds. */
export interface Grant {
    ename: EName;
    perms: PermissionBits;
}

/** Access removals. A denial always wins over any grant. */
export interface Denials {
    /** Deny by identity. */
    enames: EName[];
    /** Deny a party that fails the check. */
    conditions: Condition[];
}

/** The `_acl` block, stored inside the record it protects. */
export interface AclBlock {
    v: 1;
    grants: Grant[];
    denials: Denials;
    /** Applied to unnamed principals that pass a `require` group. */
    default_perms: PermissionBits;
    require: Requirement;
}

/** What kind of party an eName denotes, for grant specificity. */
export type PrincipalKind = "user" | "platform";

/** The party requesting an action, as resolved at check time. */
export interface Principal {
    /** The acting party's own eName. */
    ename: EName;
    kind: PrincipalKind;
    /** The platform acting on the party's behalf, when distinct from `ename`. */
    platform?: EName;
    /** Group eNames the party belongs to. Groups resolve to members at check time. */
    groups?: EName[];
}

/** Why {@link evaluate} reached its verdict. */
export type DecisionReason =
    /** Step 1: the party, its platform, or one of its groups is denied by name. */
    | "denied_by_ename"
    /** Step 1: a deny condition applied. */
    | "denied_by_condition"
    /** Step 2: a direct grant decided the outcome. */
    | "grant"
    /** Step 3: a `require` group passed and `default_perms` decided the outcome. */
    | "ontology"
    /** Step 3: no group passed. */
    | "no_matching_group";

export interface Decision {
    allowed: boolean;
    reason: DecisionReason;
    /** The bits the action was tested against, when a grant or `default_perms` applied. */
    perms?: PermissionBits;
    /** The eName of the grant that decided a step-2 outcome. */
    matchedGrant?: EName;
}

/**
 * Resolves the Resource Link Ontology half of the design.
 *
 * Implementations fetch the value the `condition.ontology` describes for
 * `principal` — per the design, the score lives on the eVault of the platform
 * that is its subject — resolve `condition.path` against it, and compare.
 *
 * A path that is missing, resolves to multiple nodes, or resolves to a
 * non-numeric value MUST return `false`. A condition never fails open.
 */
export interface ConditionEvaluator {
    passes(condition: Condition, principal: Principal): Promise<boolean>;
}

/**
 * Resolves a group eName to the eNames of its members.
 *
 * A group's participant list may reference a member either by their eName or
 * by the id of their profile record; an implementation is expected to return
 * eNames whichever form it found.
 */
export interface GroupResolver {
    membersOf(group: EName): Promise<EName[]>;
}

/** Collaborators {@link evaluate} may call out to. */
export interface EvaluateDeps {
    /** Resolves Resource Link Ontology conditions. */
    conditions?: ConditionEvaluator;
    /** Resolves group membership for grants and denials naming a group. */
    groups?: GroupResolver;
}
