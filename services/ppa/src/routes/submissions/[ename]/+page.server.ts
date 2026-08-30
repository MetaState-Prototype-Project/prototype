import { randomUUID } from "node:crypto";
import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import {
    accreditationKey,
    currentAccreditations,
    listAccreditations,
    findMessenger,
    getAuthors,
    listDeployments,
    listSubmissions,
} from "$lib/server/aaas";
import { storeAccreditation, storeAssessment } from "$lib/server/evault";
import { jwksUri, signAccreditation } from "$lib/server/jwt";
import {
    type Accreditation,
    type Assessment,
} from "$lib/server/ontology";
import { computeLevel, isAccessLevel, type DimensionAnswer } from "$lib/levels";
import { listDomains, validDomains } from "$lib/server/domains";
import { collectReputation } from "$lib/server/reputation";
import { deriveAnswers, loadFramework } from "$lib/server/framework";
import {
    accountableActors,
    deriveIdentity,
    minimumIdentity,
    type ActorIdentity,
} from "$lib/server/identity";
import { repositoryBaseUrl } from "$lib/server/env";
import { submissionSupersedesDecision } from "$lib/server/submission-proof";

export const load: PageServerLoad = async ({ params }) => {
    const ename = decodeURIComponent(params.ename);

    const [submissions, messenger, decided, domains, allDecisions] =
        await Promise.all([
            listSubmissions(),
            findMessenger(),
            currentAccreditations().catch(() => new Map<string, Accreditation>()),
            listDomains(),
            listAccreditations().catch(() => [] as Accreditation[]),
        ]);

    const submission = submissions.find((s) => s.ename === ename);
    if (!submission) {
        throw error(404, "This platform isn't awaiting review.");
    }

    const recordedDecision =
        decided.get(accreditationKey(ename, submission.version)) ?? null;
    // Every decision ever taken on this platform, oldest first, so the page
    // can show the exchange rather than only its latest turn.
    const history = allDecisions
        .filter((d) => d.platformEName === ename)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

    const framework = await loadFramework();

    // Identity is derived per actor and reduced to the weakest, because that is
    // what the framework caps the level on.
    const cache = new Map();
    const roles = accountableActors(submission);
    const identities = await Promise.all(
        roles.map(async (actor) => ({
            ...(await deriveIdentity(actor.ename, cache)),
            role: actor.role,
        })),
    );
    const minimumIal = minimumIdentity(identities as ActorIdentity[]);

    const [deployments, reputation] = await Promise.all([
        listDeployments(ename, submission.version).catch(() => []),
        collectReputation(submission.platformName, identities),
    ]);
    const derivedAnswers = deriveAnswers(framework, {
        submission,
        minimumIal,
        actors: identities as ActorIdentity[],
        deployments,
        reputation,
    });

    // Built here so the page never has to know about configuration.
    const base = repositoryBaseUrl();
    const repository = submission.submissionProof.statement.repository;
    let repositoryUrl: string | null = null;
    if (base && repository) {
        try {
            repositoryUrl = new URL(
                repository.replace(/^\/+/, ""),
                base.endsWith("/") ? base : `${base}/`,
            ).toString();
        } catch {
            console.warn(
                `[ppa] PPA_REPOSITORY_BASE_URL is not a usable base URL: ${base}`,
            );
        }
    }

    return {
        submission,
        history,
        framework,
        actors: identities,
        minimumIal,
        derivedAnswers,
        deployments,
        reputation,
        repositoryUrl,
        authors: await getAuthors(submission.authorEnames, messenger),
        messengerConfigured: messenger !== null,
        domains,
        // Only what this platform asked for is offered to the reviewer.
        requestedDomains: domains.filter((d) =>
            submission.requestedDomains.includes(d.id),
        ),
        currentDecision:
            recordedDecision &&
            !submissionSupersedesDecision(
                submission.submissionProof,
                recordedDecision,
            )
                ? recordedDecision
                : null,
    };
};

export const actions: Actions = {
    /**
     * Issue a decision: sign it, then write it into the PPA's eVault. The JWS
     * is produced first so that nothing is ever persisted unsigned.
     */
    decide: async ({ request, params, locals }) => {
        const reviewer = locals.user?.ename;
        if (!reviewer) return fail(401, { message: "Your session has ended. Sign in again." });

        const form = await request.formData();
        const decision = String(form.get("decision") ?? "");
        const rawLevel = String(form.get("level") ?? "");
        const statement = String(form.get("statement") ?? "").trim();
        const requested = await validDomains(
            form.getAll("domains").map((d) => String(d)),
        );

        if (decision !== "granted" && decision !== "denied") {
            return fail(400, { message: "Choose whether to grant or deny access." });
        }
        if (!statement) {
            return fail(400, {
                message: "Add a short explanation — it is published with your decision.",
                decision,
                level: rawLevel,
            });
        }
        if (decision === "granted" && !isAccessLevel(rawLevel)) {
            return fail(400, {
                message: "Choose an access level.",
                decision,
                statement,
            });
        }


        const ename = decodeURIComponent(params.ename);
        const submission = (await listSubmissions()).find((s) => s.ename === ename);
        if (!submission) {
            return fail(404, { message: "This platform is no longer awaiting review." });
        }

        // A decision approves what the platform asked for, or less. It can
        // never hand out access the platform never requested, so the grant is
        // intersected with the request rather than trusted from the form.
        const askedFor = new Set(submission.requestedDomains);
        const domains = requested.filter((d) => askedFor.has(d));

        if (decision === "granted" && domains.length === 0) {
            return fail(400, {
                message:
                    submission.requestedDomains.length === 0
                        ? "This platform has not requested any areas of access, so there is nothing to approve."
                        : "Approve at least one of the areas this platform requested.",
                decision,
                statement,
                level: rawLevel,
            });
        }

        // The matrix arrives as one field per dimension; the derived rows are
        // recomputed here rather than trusted from the form, so a crafted post
        // cannot claim evidence the app did not establish.
        const framework = await loadFramework();
        const reviewerAnswers: DimensionAnswer[] = [];
        for (const dimension of framework.dimensions) {
            if (dimension.source !== "reviewer") continue;
            const raw = form.get(`dimension:${dimension.id}`);
            if (raw === null) continue;
            const option = Number.parseInt(String(raw), 10);
            if (Number.isNaN(option) || !dimension.options[option]) continue;
            reviewerAnswers.push({ id: dimension.id, option });
        }

        const level = decision === "granted" ? (rawLevel as string) : null;
        const accreditationId = randomUUID();
        const assessmentId = randomUUID();

        const cache = new Map();
        const roles = accountableActors(submission);
        const identities = await Promise.all(
            roles.map(async (actor) => ({
                ...(await deriveIdentity(actor.ename, cache)),
                role: actor.role,
            })),
        );
        const minimumIal = minimumIdentity(identities);
        const [deployments, reputation] = await Promise.all([
            listDeployments(ename, submission.version).catch(() => []),
            collectReputation(submission.platformName, identities),
        ]);
        const derived = deriveAnswers(framework, {
            submission,
            minimumIal,
            actors: identities,
            deployments,
            reputation,
        });
        const allAnswers = [
            ...derived.map((d) => ({ id: d.id, option: d.option })),
            ...reviewerAnswers,
        ];
        const computed = computeLevel(framework, allAnswers, minimumIal);

        // An award that differs from the evidence has to say why, so a
        // divergence between judgement and matrix is never silent.
        const overrideReason = String(form.get("overrideReason") ?? "").trim();
        if (
            decision === "granted" &&
            level !== computed.level &&
            !overrideReason
        ) {
            return fail(400, {
                message:
                    computed.level === null
                        ? `The assessment supports no level yet. Explain why you are awarding ${level} anyway.`
                        : `The assessment supports ${computed.level}. Explain why you are awarding ${level} instead.`,
                decision,
                statement,
                level: rawLevel,
            });
        }
        // A version can be refused and reapply, so name the decision this one
        // replaces instead of leaving the order to be inferred.
        const applicantResponse =
            submission.submissionProof.statement.responseToDecision?.trim() || null;
        const applicantSubmittedAt =
            submission.submissionProof.statement.issuedAt ?? null;
        const previous =
            (await currentAccreditations().catch(
                () => new Map<string, Accreditation>(),
            )).get(accreditationKey(ename, submission.version)) ?? null;

        try {
            const jws = await signAccreditation({
                accreditationId,
                platformEName: ename,
                platformName: submission.platformName,
                platformVersion: submission.version,
                domains: decision === "granted" ? domains : [],
                decision,
                level,
                statement,
                reviewedByEName: reviewer,
                submissionEnvelopeId: submission.submissionEnvelopeId,
                supersedes: previous?.accreditationId ?? null,
                applicantResponse,
                frameworkVersion: framework.frameworkVersion,
                computedLevel: computed.level,
                minimumIal,
            });

            const accreditation: Accreditation = {
                accreditationId,
                platformEName: ename,
                platformName: submission.platformName,
                platformVersion: submission.version,
                decision,
                level,
                domains: decision === "granted" ? domains : [],
                statement,
                reviewedByEName: reviewer,
                issuerJwksUri: jwksUri(),
                submissionEnvelopeId: submission.submissionEnvelopeId,
                supersedes: previous?.accreditationId ?? null,
                applicantResponse,
                applicantSubmittedAt,
                frameworkVersion: framework.frameworkVersion,
                computedLevel: computed.level,
                minimumIal,
                assessmentEnvelopeId: "",
                jws,
                createdAt: new Date().toISOString(),
            };

            const assessment: Assessment = {
                assessmentId,
                platformEName: ename,
                platformVersion: submission.version,
                frameworkVersion: framework.frameworkVersion,
                dimensions: allAnswers.map((answer) => {
                    const dimension = framework.dimensions.find(
                        (d) => d.id === answer.id,
                    );
                    const option = dimension?.options[answer.option];
                    return {
                        id: answer.id,
                        answer: option?.label ?? "",
                        level: option?.level ?? -1,
                        source: dimension?.source ?? "reviewer",
                        note: null,
                    };
                }),
                actors: identities.map((actor) => ({
                    ename: actor.ename,
                    role: actor.role,
                    ial: actor.ial,
                    idDocuments: actor.idDocuments,
                    attestations: actor.attestations,
                    verifiedAttesters: actor.verifiedAttesters,
                    overridden: false,
                    note: actor.error ?? null,
                })),
                minimumIal,
                computedLevel: computed.level,
                limitingDimension: computed.limiting,
                awardedLevel: level as Assessment["awardedLevel"],
                overrideReason: overrideReason || null,
                reviewedByEName: reviewer,
                createdAt: new Date().toISOString(),
            };
            // Findings first: the certificate cites the assessment, so the
            // evidence must exist before anything points at it.
            const assessmentEnvelopeId = await storeAssessment(assessment);

            await storeAccreditation({
                ...accreditation,
                assessmentEnvelopeId,
            });
            return { issued: accreditation, assessment };
        } catch (err) {
            console.error("[ppa] failed issuing accreditation:", err);
            return fail(500, {
                message: "Something went wrong issuing the decision. Try again.",
            });
        }
    },
};
