import type { PageServerLoad } from "./$types";
import {
    accreditationKey,
    currentAccreditations,
    isReadConfigured,
    listSubmissions,
} from "$lib/server/aaas";
import { submissionSupersedesDecision } from "$lib/server/submission-proof";

/**
 * The review queue. Submissions come from AaaS; the decision badge comes from
 * the PPA's own eVault, so a platform already ruled on is visibly distinct
 * from one still waiting.
 */
export const load: PageServerLoad = async () => {
    if (!isReadConfigured()) {
        console.error(
            "[ppa] PPA_AWARENESS_API_KEY / AWARENESS_API_KEY is not set — the submission queue cannot be read",
        );
        return { submissions: [], loadError: null, connected: false };
    }

    const [submissions, decided] = await Promise.all([
        listSubmissions().catch((error) => {
            console.error("[ppa] failed loading submissions:", error);
            return null;
        }),
        currentAccreditations().catch((error) => {
            console.error("[ppa] failed loading accreditations:", error);
            return new Map();
        }),
    ]);

    if (submissions === null) {
        return {
            submissions: [],
            connected: true,
            // Deliberately vague: the cause is operational, and the detail
            // is already in the server log above.
            loadError:
                "We couldn't reach the platform directory just now. Try again in a moment.",
        };
    }

    return {
        submissions: submissions.map((submission) => {
            // Scoped to the submitted version: an older version's decision
            // says nothing about the one being offered now.
            const recordedDecision =
                decided.get(
                    accreditationKey(submission.ename, submission.version),
                ) ?? null;
            const decision =
                recordedDecision &&
                !submissionSupersedesDecision(
                    submission.submissionProof,
                    recordedDecision,
                )
                    ? recordedDecision
                    : null;
            return {
                ...submission,
                decision: decision
                    ? {
                          decision: decision.decision,
                          level: decision.level,
                          createdAt: decision.createdAt,
                      }
                    : null,
            };
        }),
        loadError: null,
        connected: true,
    };
};
