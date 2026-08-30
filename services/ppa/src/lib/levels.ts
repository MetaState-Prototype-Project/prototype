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
    /** The geometric mean itself, before flooring — shown in the calculation. */
    score: number;
    /**
     * The level the evidence alone supports, before the identity floor is
     * applied. Shown alongside `level` so a cap reads as a cap rather than as
     * an arithmetic mistake.
     */
    scoredLevel: AccessLevel | null;
    /** Weakest dimension, or "identity" when the IAL floor is what capped it. */
    limiting: string | null;
    /** True when a dimension fails outright, so no level can be awarded. */
    blocked: boolean;
    /** Per-dimension satisfied level, for display. */
    perDimension: { id: string; level: number }[];
}

/**
 * The level a set of answers supports: the geometric mean of the per-dimension
 * levels, floored.
 *
 * A geometric mean keeps the framework's point that "a strong result in one
 * dimension does not erase a weakness in another" — a low row drags the result
 * far more than an arithmetic mean would — without letting one middling row pin
 * an otherwise strong release to its own value the way a strict minimum did.
 *
 * The mean is taken over level + 1 and shifted back afterwards. L0 is a real,
 * expected answer on this scale (a code review nobody performed is L0), and a
 * plain geometric mean multiplies by zero, so a single such row would collapse
 * the score to zero no matter how strong the other fifteen were.
 *
 * The identity floor is applied afterwards as a hard cap, because the framework
 * states it as a requirement rather than a contribution: L0 needs IAL2, L1–L2
 * need IAL3, L3–L5 need IAL4.
 *
 * Returns null when nothing is supportable — an unanswered dimension, an answer
 * that fails outright, or an anonymous responsible party.
 */
export function computeLevel(
    framework: Framework,
    answers: DimensionAnswer[],
    minimumIal: IdentityLevel,
): ComputedLevel {
    const byId = new Map(answers.map((a) => [a.id, a]));
    const perDimension: { id: string; level: number }[] = [];

    let lowest = Number.POSITIVE_INFINITY;
    let limiting: string | null = null;
    let blocked = false;

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
        if (satisfied < 0) blocked = true;
    }

    if (blocked || perDimension.length === 0) {
        return {
            level: null,
            score: 0,
            scoredLevel: null,
            limiting,
            blocked: true,
            perDimension,
        };
    }

    // Geometric mean over level + 1, shifted back, so a legitimate L0 row
    // weighs heavily without annihilating the product.
    const score =
        Math.exp(
            perDimension.reduce((acc, d) => acc + Math.log(d.level + 1), 0) /
                perDimension.length,
        ) - 1;

    // exp(mean(ln 6)) - 1 lands a hair under 5, so floor alone would award L4
    // for a flawless assessment. Nudge past the float error before flooring.
    let index = Math.floor(score + 1e-9);
    const scoredLevel = levelFromIndex(index);

    // The identity floor: the highest level whose required IAL is met.
    let identityCap = -1;
    for (let i = ACCESS_LEVELS.length - 1; i >= 0; i--) {
        const required = framework.identityFloor[ACCESS_LEVELS[i]];
        if (identityIndex(minimumIal) >= identityIndex(required)) {
            identityCap = i;
            break;
        }
    }
    if (identityCap < index) {
        index = identityCap;
        limiting = "identity";
    }

    return {
        level: levelFromIndex(index),
        score,
        scoredLevel,
        limiting,
        blocked: false,
        perDimension,
    };
}
