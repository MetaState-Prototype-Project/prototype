import { Request, Response } from "express";
import { default as Axios } from "axios";
import FormData from "form-data";
import { validate as uuidValidate } from "uuid";
import type { VerificationService } from "../services/VerificationService";
import { signAsProvisioner } from "../core/utils/provisioner-signer";

const diditClient = Axios.create({ baseURL: "https://verification.didit.me" });

const FACE_SIMILARITY_THRESHOLD = 75;

export class RecoveryController {
    constructor(private readonly verificationService: VerificationService) {}

    private normalizeDocumentNumber(value: unknown): string {
        return typeof value === "string" ? value.trim().toUpperCase() : "";
    }

    private toIdVerifPayload(idVerif: any) {
        if (!idVerif) return null;
        return {
            full_name: idVerif.full_name,
            first_name: idVerif.first_name,
            last_name: idVerif.last_name,
            date_of_birth: idVerif.date_of_birth,
            document_type: idVerif.document_type,
            document_number: this.normalizeDocumentNumber(idVerif.document_number),
            issuing_state_name: idVerif.issuing_state_name,
            issuing_state: idVerif.issuing_state,
            expiration_date: idVerif.expiration_date,
            date_of_issue: idVerif.date_of_issue,
        };
    }

    private async getPlatformToken(): Promise<string> {
        const registryUrl = process.env.PUBLIC_REGISTRY_URL;
        const platformName = process.env.PLATFORM_NAME ?? "provisioner";
        if (!registryUrl) throw new Error("PUBLIC_REGISTRY_URL not set");
        const tokenRes = await Axios.post(
            new URL("/platforms/certification", registryUrl).toString(),
            { platform: platformName },
            { headers: { "Content-Type": "application/json" } },
        );
        return tokenRes.data.token as string;
    }

    private async fetchBindingDocumentTypes(
        w3id: string,
        token: string,
    ): Promise<Set<string>> {
        const evaultUrl = process.env.PUBLIC_EVAULT_SERVER_URI;
        if (!evaultUrl) return new Set();
        const subject = w3id.startsWith("@") ? w3id : `@${w3id}`;
        const gqlUrl = new URL("/graphql", evaultUrl).toString();

        const gqlRes = await Axios.post(
            gqlUrl,
            {
                query: `query {
                    bindingDocuments(first: 50) {
                        edges { node { parsed } }
                    }
                }`,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-ENAME": subject,
                    Authorization: `Bearer ${token}`,
                },
            },
        );

        const edges: { node: { parsed: { type?: string } | null } }[] =
            gqlRes.data?.data?.bindingDocuments?.edges ?? [];
        const types = new Set<string>();
        for (const edge of edges) {
            const t = edge?.node?.parsed?.type;
            if (typeof t === "string") types.add(t);
        }
        return types;
    }

    private async createIdDocumentBindingDocument(
        w3id: string,
        reference: string,
        fullName: string,
        token: string,
    ): Promise<void> {
        const evaultUrl = process.env.PUBLIC_EVAULT_SERVER_URI;
        if (!evaultUrl) return;
        const subject = w3id.startsWith("@") ? w3id : `@${w3id}`;
        const data = { vendor: "didit", reference, name: fullName };
        const ownerSignature = signAsProvisioner({
            subject,
            type: "id_document",
            data: data as any,
        });

        const gqlUrl = new URL("/graphql", evaultUrl).toString();
        await Axios.post(
            gqlUrl,
            {
                query: `mutation CreateBindingDocument($input: CreateBindingDocumentInput!) {
                    createBindingDocument(input: $input) {
                        metaEnvelopeId
                        errors { message code }
                    }
                }`,
                variables: {
                    input: { subject, type: "id_document", data, ownerSignature },
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-ENAME": subject,
                    Authorization: `Bearer ${token}`,
                },
            },
        );
    }

    private async createPhotographBindingDocument(
        w3id: string,
        portraitImageUrl: string,
        token: string,
        apiKey: string,
    ): Promise<void> {
        const evaultUrl = process.env.PUBLIC_EVAULT_SERVER_URI;
        if (!evaultUrl) return;
        const subject = w3id.startsWith("@") ? w3id : `@${w3id}`;
        const imageResponse = await diditClient.get(portraitImageUrl, {
            headers: { "x-api-key": apiKey },
            responseType: "arraybuffer",
        });
        const contentType =
            (imageResponse.headers["content-type"] as string | undefined) ??
            "image/jpeg";
        const base64 = Buffer.from(imageResponse.data as ArrayBuffer).toString(
            "base64",
        );
        const photoBlob = `data:${contentType};base64,${base64}`;
        const data = { photoBlob };
        const ownerSignature = signAsProvisioner({
            subject,
            type: "photograph",
            data: data as any,
        });

        const gqlUrl = new URL("/graphql", evaultUrl).toString();
        await Axios.post(
            gqlUrl,
            {
                query: `mutation CreateBindingDocument($input: CreateBindingDocumentInput!) {
                    createBindingDocument(input: $input) {
                        metaEnvelopeId
                        errors { message code }
                    }
                }`,
                variables: {
                    input: { subject, type: "photograph", data, ownerSignature },
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-ENAME": subject,
                    Authorization: `Bearer ${token}`,
                },
            },
        );
    }

    private async ensureRecoveryBindingDocuments(
        w3id: string,
        idVerif: any,
        diditSessionId: string,
        apiKey: string,
    ): Promise<void> {
        const fullName = (
            idVerif?.full_name ??
            `${idVerif?.first_name ?? ""} ${idVerif?.last_name ?? ""}`
        ).trim();
        const portraitUrl: string = idVerif?.portrait_image ?? "";

        if (!fullName && !portraitUrl) return;

        const token = await this.getPlatformToken();
        const existingTypes = await this.fetchBindingDocumentTypes(w3id, token);

        if (!existingTypes.has("id_document") && fullName) {
            await this.createIdDocumentBindingDocument(
                w3id,
                diditSessionId,
                fullName,
                token,
            );
            console.log(`[RECOVERY] Backfilled id_document for ${w3id}`);
        }

        if (!existingTypes.has("photograph") && portraitUrl) {
            await this.createPhotographBindingDocument(
                w3id,
                portraitUrl,
                token,
                apiKey,
            );
            console.log(`[RECOVERY] Backfilled photograph for ${w3id}`);
        }
    }

    registerRoutes(app: any) {
        /**
         * POST /recovery/start-session
         *
         * Creates a Didit session using DIDIT_RECOVER_WORKFLOW_ID (liveness only).
         * Returns { verificationUrl, sessionToken, id }.
         */
        app.post("/recovery/start-session", async (req: Request, res: Response) => {
            const apiKey = process.env.DIDIT_API_KEY;
            const workflowId = process.env.DIDIT_RECOVER_WORKFLOW_ID;
            if (!apiKey || !workflowId) {
                return res.status(500).json({ error: "DIDIT_API_KEY or DIDIT_RECOVER_WORKFLOW_ID not configured" });
            }

            try {
                const verification = await this.verificationService.create({});

                const { data: diditSession } = await diditClient.post(
                    "/v3/session/",
                    { workflow_id: workflowId, vendor_data: verification.id },
                    { headers: { "x-api-key": apiKey, "Content-Type": "application/json" } },
                );

                const sessionToken: string = diditSession.session_token;
                const sessionId: string = diditSession.session_id ?? diditSession.id ?? verification.id;
                const verificationUrl: string =
                    diditSession.verification_url ??
                    diditSession.url ??
                    `https://verify.didit.me/session/${sessionToken}`;

                await this.verificationService.findByIdAndUpdate(verification.id, {
                    diditSessionId: sessionId,
                    verificationUrl,
                    sessionToken,
                });

                console.log(`[RECOVERY] Session created: ${sessionId}`);
                return res.status(201).json({ id: verification.id, sessionToken, verificationUrl });
            } catch (err: any) {
                console.error("[RECOVERY] start-session error:", err?.response?.data ?? err?.message);
                return res.status(500).json({ error: "Failed to create recovery session" });
            }
        });

        /**
         * POST /recovery/face-search
         * JSON: { diditSessionId: string }
         *
         * 1. Fetches the recovery session decision from Didit.
         * 2. Requires liveness_checks[0].status === "Approved".
         * 3. Runs a full Didit /v3/face-search/ using liveness reference_image.
         * 4. Iterates face_search matches, filtered to approved,
         *    non-blocklisted entries with similarity >= FACE_SIMILARITY_THRESHOLD.
         * 5. For each candidate, looks up the Verification record by vendor_data
         *    (fallback: diditSessionId === matched session_id).
         * 6. On a hit, fetches the *matched* session's full decision to extract
         *    id_verifications[0] (the original provisioning session had an ID doc scan).
         * 7. Returns { success, w3id, uri, idVerif } or { success: false, reason }.
         */
        app.post("/recovery/face-search", async (req: Request, res: Response) => {
            const { diditSessionId } = req.body as { diditSessionId?: string };
            if (!diditSessionId) {
                return res.status(400).json({ error: "diditSessionId is required" });
            }
            if (!uuidValidate(diditSessionId)) {
                return res.status(400).json({
                    error: "diditSessionId must be a valid UUID",
                });
            }

            const apiKey = process.env.DIDIT_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: "DIDIT_API_KEY not configured" });
            }

            const evaultUrl = process.env.PUBLIC_EVAULT_SERVER_URI;
            if (!evaultUrl) {
                return res.status(500).json({ error: "PUBLIC_EVAULT_SERVER_URI not configured" });
            }

            try {
                const { data: decision } = await diditClient.get(
                    `/v3/session/${encodeURIComponent(diditSessionId)}/decision/`,
                    { headers: { "x-api-key": apiKey } },
                );
                const recoveryIdVerif = decision?.id_verifications?.[0] ?? null;
                const recoveryDocumentNumber = this.normalizeDocumentNumber(
                    recoveryIdVerif?.document_number,
                );

                const liveness = decision?.liveness_checks?.[0];
                if (!liveness || liveness.status?.toLowerCase() !== "approved") {
                    console.warn("[RECOVERY] Liveness not approved:", liveness?.status);
                    return res.json({ success: false, reason: "liveness_failed" });
                }

                const referenceImageUrl: string = liveness?.reference_image ?? "";
                if (!referenceImageUrl) {
                    console.warn("[RECOVERY] Missing liveness reference_image for face search");
                    return res.json({ success: false, reason: "no_match" });
                }

                const imageResponse = await diditClient.get(referenceImageUrl, {
                    headers: { "x-api-key": apiKey },
                    responseType: "arraybuffer",
                });
                const contentType =
                    (imageResponse.headers["content-type"] as string | undefined) ??
                    "image/jpeg";
                const extension =
                    contentType.includes("png")
                        ? "png"
                        : contentType.includes("webp")
                            ? "webp"
                            : contentType.includes("tiff")
                                ? "tiff"
                                : "jpg";

                const faceSearchForm = new FormData();
                faceSearchForm.append(
                    "user_image",
                    Buffer.from(imageResponse.data as ArrayBuffer),
                    {
                        filename: `recovery-reference.${extension}`,
                        contentType,
                    },
                );
                faceSearchForm.append("search_type", "most_similar");
                faceSearchForm.append("rotate_image", "false");
                faceSearchForm.append("save_api_request", "true");
                faceSearchForm.append("vendor_data", diditSessionId);

                const { data: faceSearch } = await diditClient.post(
                    "/v3/face-search/",
                    faceSearchForm,
                    {
                        headers: {
                            "x-api-key": apiKey,
                            ...faceSearchForm.getHeaders(),
                        },
                    },
                );

                // Filter to quality candidates only
                const candidates: any[] = ((faceSearch?.face_search?.matches ?? []) as any[])
                    .filter(
                    (m: any) =>
                        m.status?.toLowerCase() === "approved" &&
                        !m.is_blocklisted &&
                        (m.similarity_percentage ?? 0) >= FACE_SIMILARITY_THRESHOLD,
                    )
                    .sort(
                        (a: any, b: any) =>
                            (b.similarity_percentage ?? 0) - (a.similarity_percentage ?? 0),
                    );

                for (const match of candidates) {
                    const vendorData: string = match.vendor_data ?? "";
                    let record = vendorData
                        ? await this.verificationService.findOne({ id: vendorData })
                        : null;
                    if (!record?.linkedEName && match.session_id) {
                        record = await this.verificationService.findOne({
                            diditSessionId: match.session_id,
                        });
                    }
                    if (!record?.linkedEName) continue;

                    // Fetch the original provisioning session to get the ID document data
                    let idVerif: any = null;
                    try {
                        const { data: matchedDecision } = await diditClient.get(
                            `/v3/session/${match.session_id}/decision/`,
                            { headers: { "x-api-key": apiKey } },
                        );
                        idVerif = matchedDecision?.id_verifications?.[0] ?? null;
                    } catch (err: any) {
                        console.warn("[RECOVERY] Could not fetch matched session decision:", err?.message);
                    }

                    console.log(
                        `[RECOVERY] eVault found via face-search: eName=${record.linkedEName} similarity=${match.similarity_percentage}%`,
                    );

                    return res.json({
                        success: true,
                        w3id: record.linkedEName,
                        uri: evaultUrl,
                        idVerif: this.toIdVerifPayload(idVerif),
                    });
                }

                // Fallback for older or low-quality captures:
                // try recovering by normalized document number.
                if (recoveryDocumentNumber) {
                    let [docMatches] =
                        await this.verificationService.findManyAndCount({
                            documentId: recoveryDocumentNumber,
                        });

                    // Backward compatibility for historical non-normalized rows
                    if (docMatches.length === 0) {
                        const rawDocumentNumber =
                            typeof recoveryIdVerif?.document_number === "string"
                                ? recoveryIdVerif.document_number
                                : "";
                        if (
                            rawDocumentNumber &&
                            rawDocumentNumber !== recoveryDocumentNumber
                        ) {
                            [docMatches] =
                                await this.verificationService.findManyAndCount({
                                    documentId: rawDocumentNumber,
                                });
                        }
                    }

                    const linkedMatches = docMatches
                        .filter((v) => !!v.linkedEName)
                        .sort(
                            (a, b) =>
                                new Date(b.updatedAt).getTime() -
                                new Date(a.updatedAt).getTime(),
                        );
                    const fallbackRecord = linkedMatches[0];

                    if (fallbackRecord?.linkedEName) {
                        // Ensure recovery artifacts exist when dumb fallback succeeds.
                        try {
                            await this.ensureRecoveryBindingDocuments(
                                fallbackRecord.linkedEName,
                                recoveryIdVerif,
                                diditSessionId,
                                apiKey,
                            );
                        } catch (ensureErr: any) {
                            console.warn(
                                "[RECOVERY] Could not ensure binding docs during fallback:",
                                ensureErr?.response?.data ?? ensureErr?.message,
                            );
                        }

                        console.log(
                            `[RECOVERY] eVault found via document fallback: eName=${fallbackRecord.linkedEName}`,
                        );
                        return res.json({
                            success: true,
                            w3id: fallbackRecord.linkedEName,
                            uri: evaultUrl,
                            idVerif: this.toIdVerifPayload(recoveryIdVerif),
                        });
                    }
                }

                console.warn("[RECOVERY] No matching eVault found above threshold");
                return res.json({ success: false, reason: "no_match" });
            } catch (err: any) {
                console.error("[RECOVERY] face-search error:", err?.response?.data ?? err?.message);
                return res.status(500).json({ error: "Face search failed" });
            }
        });

        /**
         * POST /recovery/face-match
         * JSON: { w3id: string, userImageBase64: string }
         *
         * Kept for potential future use. Not called by the current recovery flow.
         * Fetches the photograph binding document and runs Didit face-match.
         */
        app.post("/recovery/face-match", async (req: Request, res: Response) => {
            const { w3id, userImageBase64 } = req.body as {
                w3id?: string;
                userImageBase64?: string;
            };

            if (!w3id || !userImageBase64) {
                return res.status(400).json({ error: "w3id and userImageBase64 are required" });
            }

            const apiKey = process.env.DIDIT_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: "DIDIT_API_KEY not configured" });
            }

            const evaultUrl = process.env.PUBLIC_EVAULT_SERVER_URI;
            if (!evaultUrl) {
                return res.status(500).json({ error: "PUBLIC_EVAULT_SERVER_URI not configured" });
            }

            try {
                const subject = w3id.startsWith("@") ? w3id : `@${w3id}`;
                const gqlUrl = new URL("/graphql", evaultUrl).toString();

                let platformToken: string;
                try {
                    const registryUrl = process.env.PUBLIC_REGISTRY_URL;
                    if (!registryUrl) throw new Error("PUBLIC_REGISTRY_URL not set");
                    const tokenRes = await Axios.post(
                        new URL("/platforms/certification", registryUrl).toString(),
                        { platform: process.env.PLATFORM_NAME ?? "provisioner" },
                        { headers: { "Content-Type": "application/json" } },
                    );
                    platformToken = tokenRes.data.token as string;
                } catch (err: any) {
                    console.error("[RECOVERY] Failed to get platform token:", err?.message);
                    return res.status(500).json({ error: "Failed to authenticate with eVault" });
                }

                const gqlRes = await Axios.post(
                    gqlUrl,
                    { query: `query { bindingDocuments(first: 50) { edges { node { parsed } } } }` },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            "X-ENAME": subject,
                            Authorization: `Bearer ${platformToken}`,
                        },
                    },
                );

                const edges: { node: { parsed: any } }[] =
                    gqlRes.data?.data?.bindingDocuments?.edges ?? [];

                const photoBd = edges.find((e) => e.node.parsed?.type === "photograph");
                if (!photoBd) return res.json({ success: false, reason: "no_photograph_doc" });

                const photoBlob: string = photoBd.node.parsed?.data?.photoBlob ?? "";
                if (!photoBlob) return res.json({ success: false, reason: "no_photograph_doc" });

                const toBuffer = (dataUri: string): { buffer: Buffer; mime: string } => {
                    const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
                    if (m) return { buffer: Buffer.from(m[2], "base64"), mime: m[1] };
                    return { buffer: Buffer.from(dataUri, "base64"), mime: "image/jpeg" };
                };

                const userImg = toBuffer(userImageBase64);
                const refImg = toBuffer(photoBlob);

                const fd = new FormData();
                fd.append("user_image", userImg.buffer, { filename: "selfie.jpg", contentType: userImg.mime });
                fd.append("ref_image", refImg.buffer, { filename: "ref.jpg", contentType: refImg.mime });
                fd.append("face_match_score_decline_threshold", "60");
                fd.append("save_api_request", "true");

                const faceMatchRes = await diditClient.post("/v3/face-match/", fd, {
                    headers: { "x-api-key": apiKey, ...fd.getHeaders() },
                });

                const faceMatchStatus: string = faceMatchRes.data?.face_match?.status ?? "";
                const score: number = faceMatchRes.data?.face_match?.score ?? 0;

                if (faceMatchStatus.toLowerCase() !== "approved") {
                    console.warn(`[RECOVERY] Face match failed: score=${score}`);
                    return res.json({ success: false, reason: "face_mismatch", score });
                }

                console.log(`[RECOVERY] Face match confirmed: eName=${w3id} score=${score}`);
                return res.json({ success: true, w3id, score, uri: evaultUrl });
            } catch (err: any) {
                console.error("[RECOVERY] face-match error:", err?.response?.data ?? err?.message);
                return res.status(500).json({ error: "Face match failed" });
            }
        });
    }
}
