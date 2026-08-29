import { randomUUID } from "node:crypto";
import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import {
    accreditationKey,
    currentAccreditations,
    listAccreditations,
    findMessenger,
    getAuthors,
    listSubmissions,
} from "$lib/server/aaas";
import { storeAccreditation } from "$lib/server/evault";
import { jwksUri, signAccreditation } from "$lib/server/jwt";
import { type Accreditation, isAccessLevel } from "$lib/server/ontology";
import { listDomains, validDomains } from "$lib/server/domains";
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

    return {
        submission,
        history,
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

        const level = decision === "granted" ? (rawLevel as string) : null;
        const accreditationId = randomUUID();
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
                jws,
                createdAt: new Date().toISOString(),
            };

            await storeAccreditation(accreditation);
            return { issued: accreditation };
        } catch (err) {
            console.error("[ppa] failed issuing accreditation:", err);
            return fail(500, {
                message: "Something went wrong issuing the decision. Try again.",
            });
        }
    },
};
