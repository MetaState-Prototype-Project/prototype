/**
 * The certification framework, and the rows the app can answer for itself.
 *
 * The matrix is policy with provisional thresholds, so it is loaded from a
 * versioned file rather than hard-coded, and every assessment records the
 * version that judged it.
 */

import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { ActorIdentity } from "./identity";
import type { Submission } from "./ontology";
import type { ReputationEvidence } from "./reputation";
import type { Framework, IdentityLevel } from "$lib/levels";

const CACHE = Symbol.for("ppa.framework");
const store = globalThis as typeof globalThis & {
    [CACHE]?: { mtimeMs: number; framework: Framework };
};

/**
 * Reloads when the file changes rather than caching for the life of the
 * process. This is editable policy, and a cache that outlives an edit means a
 * reviewer changes the matrix, sees no difference, and has no way to tell
 * whether the file or the app is wrong.
 */
export async function loadFramework(): Promise<Framework> {
    // cwd is services/ppa under both `vite dev` and `node build/index.js`.
    const file = path.resolve(process.cwd(), "config/certification-framework.json");
    const cached = store[CACHE];
    try {
        const { mtimeMs } = await stat(file);
        if (cached && cached.mtimeMs === mtimeMs) return cached.framework;
        const framework = JSON.parse(await readFile(file, "utf8")) as Framework;
        store[CACHE] = { mtimeMs, framework };
        return framework;
    } catch (error) {
        // An unreadable file must not blank the matrix mid-review.
        if (cached) {
            console.error("[ppa/framework] could not reload the matrix:", error);
            return cached.framework;
        }
        throw error;
    }
}

/** Index of the option carrying a given level, for building derived answers. */
function optionAtLevel(
    framework: Framework,
    dimensionId: string,
    level: number,
): number {
    const dimension = framework.dimensions.find((d) => d.id === dimensionId);
    if (!dimension) return 0;
    const index = dimension.options.findIndex((o) => o.level === level);
    return index >= 0 ? index : 0;
}

export interface DerivedAnswer {
    id: string;
    option: number;
    /** Why the app answered this way, shown instead of asking the reviewer. */
    evidence: string;
}

/**
 * The rows the app can answer from evidence it has already verified. Everything
 * else is a reviewer judgement and is asked, because guessing at it would make
 * a certificate claim more than was actually checked.
 */
export function deriveAnswers(
    framework: Framework,
    context: {
        submission: Submission;
        minimumIal: IdentityLevel;
        actors: ActorIdentity[];
        reputation: ReputationEvidence;
    },
): DerivedAnswer[] {
    const { submission, minimumIal, actors, reputation } = context;
    const at = (id: string, level: number) => optionAtLevel(framework, id, level);

    // The submission is only in the queue at all because its release statement
    // verified against a Registry-backed key binding.
    const answers: DerivedAnswer[] = [
        {
            id: "w3ds-compatibility",
            option: at("w3ds-compatibility", 5),
            evidence: "The signed release statement verified against the Registry.",
        },
    ];

    const repository = submission.submissionProof.statement.repository;
    answers.push({
        id: "source-available",
        option: at("source-available", repository ? 5 : -1),
        evidence: repository
            ? `Published from ${repository}.`
            : "No repository named in the release statement.",
    });

    const identityLevels: Record<IdentityLevel, number> = {
        IAL1: -1,
        IAL2: 0,
        IAL3: 2,
        IAL4: 5,
    };
    answers.push({
        id: "identity-assurance",
        option: at("identity-assurance", identityLevels[minimumIal]),
        evidence:
            actors.length === 0
                ? "No accountable actor is named on the release."
                : `Weakest of ${actors.length} accountable actor${actors.length === 1 ? "" : "s"}: ${minimumIal}.`,
    });

    const commit = submission.submissionProof.statement.manifestCommitId;
    answers.push({
        id: "provenance",
        option: at("provenance", commit ? 1 : -1),
        evidence: commit
            ? `Manifest commit ${commit.slice(0, 12)} recorded, with ${submission.authorEnames.length} named author${submission.authorEnames.length === 1 ? "" : "s"}. Reviewing that history is a judgement above this row.`
            : "No manifest commit recorded.",
    });

    // The framework's reputation thresholds are counts, so they are counted.
    // Signed references are public, which is what makes this evidence rather
    // than an assertion.
    const refs = reputation.minimumActorReferences;
    const actorLevel = refs >= 10 ? 5 : refs >= 5 ? 4 : refs >= 3 ? 3 : refs >= 1 ? 2 : 1;
    answers.push({
        id: "actor-reputation",
        option: at("actor-reputation", actorLevel),
        evidence: reputation.error
            ? `eReputation could not be reached (${reputation.error}); counted as none.`
            : actors.length === 0
              ? "No accountable actor to hold references."
              : `Weakest actor holds ${refs} signed reference${refs === 1 ? "" : "s"}.`,
    });

    const platformRefs = reputation.platformReferences;
    const trackLevel =
        platformRefs >= 10000 ? 5 : platformRefs >= 1000 ? 4 : platformRefs >= 50 ? 3 : 2;
    answers.push({
        id: "track-record",
        option: at("track-record", trackLevel),
        evidence: reputation.error
            ? `eReputation could not be reached (${reputation.error}); counted as none.`
            : `${platformRefs} authenticated signal${platformRefs === 1 ? "" : "s"} for this platform.`,
    });

    const independent = reputation.independentReviews;
    const reviewLevel = independent >= 2 ? 5 : independent === 1 ? 4 : 3;
    answers.push({
        id: "independent-review",
        option: at("independent-review", reviewLevel),
        evidence: reputation.error
            ? `eReputation could not be reached (${reputation.error}); counted as none.`
            : `${independent} signed review${independent === 1 ? "" : "s"} from outside the accountable actors.`,
    });

    answers.push({
        id: "findings-recorded",
        option: at("findings-recorded", 5),
        evidence: "This assessment is published with the certificate.",
    });

    return answers;
}
