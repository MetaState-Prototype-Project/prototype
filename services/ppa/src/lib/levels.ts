/**
 * Certification and identity vocabularies, and the pure rules that combine
 * them. Shared between server code and components, so this lives outside
 * $lib/server — SvelteKit refuses to pull a server-only module into a
 * component.
 *
 * Both lists are published by the ontology service as `Certification Level`
 * and `Identity Assurance Level`; these are the same values, kept here so the
 * form and the level computation do not need a network round trip.
 */

export const ACCESS_LEVELS = ["L0", "L1", "L2", "L3", "L4", "L5"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const IDENTITY_LEVELS = ["IAL1", "IAL2", "IAL3", "IAL4"] as const;
export type IdentityLevel = (typeof IDENTITY_LEVELS)[number];

export function isAccessLevel(value: unknown): value is AccessLevel {
    return (
        typeof value === "string" &&
        (ACCESS_LEVELS as readonly string[]).includes(value)
    );
}

export function isIdentityLevel(value: unknown): value is IdentityLevel {
    return (
        typeof value === "string" &&
        (IDENTITY_LEVELS as readonly string[]).includes(value)
    );
}

/** "L3" -> 3, and back. Levels are ordered and cumulative. */
export function levelIndex(level: AccessLevel): number {
    return ACCESS_LEVELS.indexOf(level);
}

export function levelFromIndex(index: number): AccessLevel | null {
    return index >= 0 && index < ACCESS_LEVELS.length
        ? ACCESS_LEVELS[index]
        : null;
}

export function identityIndex(level: IdentityLevel): number {
    return IDENTITY_LEVELS.indexOf(level);
}

// ---------------------------------------------------------------------------

export interface FrameworkOption {
    /** Highest certification level this requirement satisfies; -1 blocks it. */
    level: number;
    label: string;
}

export interface FrameworkDimension {
    id: string;
    label: string;
    source: "derived" | "reviewer";
    /** The ecosystem cannot verify this evidence yet (no eReputation system). */
    unverified?: boolean;
    options: FrameworkOption[];
}

export interface Framework {
    frameworkVersion: string;
    levels: { id: AccessLevel; label: string }[];
    identityFloor: Record<AccessLevel, IdentityLevel>;
    dimensions: FrameworkDimension[];
}

/** One reviewer or derived answer: the option chosen for a dimension. */
export interface DimensionAnswer {
    id: string;
    /** Index into the dimension's options. */
    option: number;
    note?: string | null;
}

export interface ComputedLevel {
    level: AccessLevel | null;
    /** Dimension id that held the level down, or "identity" for the IAL floor. */
    limiting: string | null;
    /** Per-dimension satisfied level, for display. */
    perDimension: { id: string; level: number }[];
}

/**
 * The level a set of answers supports.
 *
 * The framework is explicit that "a strong result in one dimension does not
 * erase a weakness in another", so this is the minimum across dimensions —
 * never an average and never the best row. The identity floor caps it
 * separately: L0 needs IAL2, L1–L2 need IAL3, L3–L5 need IAL4, so the weakest
 * accountable actor can pull the whole release down.
 *
 * Returns null when nothing is supportable — an unanswered dimension, an
 * answer that fails even L0, or an anonymous responsible party.
 */
export function computeLevel(
    framework: Framework,
    answers: DimensionAnswer[],
    minimumIal: IdentityLevel,
): ComputedLevel {
    const byId = new Map(answers.map((a) => [a.id, a]));
    const perDimension: { id: string; level: number }[] = [];

    let lowest = ACCESS_LEVELS.length - 1;
    let limiting: string | null = null;

    for (const dimension of framework.dimensions) {
        const answer = byId.get(dimension.id);
        const option =
            answer === undefined ? undefined : dimension.options[answer.option];
        // An unanswered dimension is not evidence of anything.
        const satisfied = option ? option.level : -1;
        perDimension.push({ id: dimension.id, level: satisfied });
        if (satisfied < lowest) {
            lowest = satisfied;
            limiting = dimension.id;
        }
    }

    // The identity floor: the highest level whose required IAL is met.
    let identityCap = -1;
    for (let i = ACCESS_LEVELS.length - 1; i >= 0; i--) {
        const required = framework.identityFloor[ACCESS_LEVELS[i]];
        if (identityIndex(minimumIal) >= identityIndex(required)) {
            identityCap = i;
            break;
        }
    }
    if (identityCap < lowest) {
        lowest = identityCap;
        limiting = "identity";
    }

    return { level: levelFromIndex(lowest), limiting, perDimension };
}
