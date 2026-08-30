/**
 * eReputation evidence for the assessment.
 *
 * References are signed statements about a person or a platform, published by
 * the eReputation application and readable without credentials, so the
 * framework's reputation rows can be counted rather than asserted.
 */

import { ereputationUrl } from "./env";

interface Reference {
    id: string;
    targetType: string;
    targetId: string;
    referenceType?: string;
    authorId?: string;
    status?: string;
    signature?: string;
}

export interface ReputationEvidence {
    /** Signed references held by the platform itself. */
    platformReferences: number;
    /** Signed references per accountable actor, keyed by eName. */
    actorReferences: Record<string, number>;
    /** Weakest actor's count — the framework asks per responsible actor. */
    minimumActorReferences: number;
    /** Platform references written by someone who is not an accountable actor. */
    independentReviews: number;
    /** Set when the service could not be reached, so counts are not evidence. */
    error?: string;
}

/** Only a signed, unrevoked reference counts. */
function isSigned(reference: Reference): boolean {
    return reference.status === "signed";
}

async function referencesFor(
    targetType: string,
    targetId: string,
): Promise<Reference[]> {
    const url = new URL(
        `/api/references/target/${targetType}/${encodeURIComponent(targetId)}`,
        ereputationUrl(),
    ).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`eReputation returned ${res.status}`);
    const body = (await res.json()) as { references?: Reference[] };
    return (body.references ?? []).filter(isSigned);
}

export async function collectReputation(
    platformName: string,
    actors: { ename: string }[],
): Promise<ReputationEvidence> {
    const empty: ReputationEvidence = {
        platformReferences: 0,
        actorReferences: {},
        minimumActorReferences: 0,
        independentReviews: 0,
    };

    try {
        const [platform, ...perActor] = await Promise.all([
            referencesFor("platform", platformName),
            ...actors.map((a) => referencesFor("user", a.ename)),
        ]);

        const actorReferences: Record<string, number> = {};
        actors.forEach((actor, index) => {
            actorReferences[actor.ename] = perActor[index]?.length ?? 0;
        });

        // "Independent" means written by someone with no accountability for the
        // release — a reference from an author about their own platform is not
        // an outside opinion.
        const insiders = new Set(actors.map((a) => a.ename.toLowerCase()));
        const independentReviews = platform.filter(
            (r) => !insiders.has(String(r.authorId ?? "").toLowerCase()),
        ).length;

        return {
            platformReferences: platform.length,
            actorReferences,
            minimumActorReferences: actors.length
                ? Math.min(...actors.map((a) => actorReferences[a.ename] ?? 0))
                : 0,
            independentReviews,
        };
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`[ppa/reputation] eReputation unavailable: ${reason}`);
        return { ...empty, error: reason };
    }
}
