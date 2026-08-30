/**
 * The certification framework, and the rows the app can answer for itself.
 *
 * The matrix is policy with provisional thresholds, so it is loaded from a
 * versioned file rather than hard-coded, and every assessment records the
 * version that judged it.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ActorIdentity } from "./identity";
import type { Submission } from "./ontology";
import type { DeploymentRecord } from "./aaas";
import type { Framework, IdentityLevel } from "$lib/levels";

const CACHE = Symbol.for("ppa.framework");
const store = globalThis as typeof globalThis & { [CACHE]?: Framework };

export async function loadFramework(): Promise<Framework> {
    if (store[CACHE]) return store[CACHE];
    // cwd is services/ppa under both `vite dev` and `node build/index.js`.
    const file = path.resolve(process.cwd(), "config/certification-framework.json");
    const framework = JSON.parse(await readFile(file, "utf8")) as Framework;
    store[CACHE] = framework;
    return framework;
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
        deployments: DeploymentRecord[];
    },
): DerivedAnswer[] {
    const { submission, minimumIal, actors, deployments } = context;
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

    answers.push({
        id: "deployment-assurance",
        option: at("deployment-assurance", deployments.length > 0 ? 3 : 0),
        evidence:
            deployments.length > 0
                ? `${deployments.length} deployment${deployments.length === 1 ? "" : "s"} attested against this exact release.`
                : "No deployment has been attested against this release.",
    });

    answers.push({
        id: "findings-recorded",
        option: at("findings-recorded", 5),
        evidence: "This assessment is published with the certificate.",
    });

    return answers;
}
