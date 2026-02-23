import { Request, Response } from "express";
import { default as Axios } from "axios";
import FormData from "form-data";
import type { VerificationService } from "../services/VerificationService";

const diditClient = Axios.create({ baseURL: "https://verification.didit.me" });

const FACE_SIMILARITY_THRESHOLD = 75;

export class RecoveryController {
    constructor(private readonly verificationService: VerificationService) {}

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
         * 3. Iterates liveness_checks[0].matches, filtered to approved,
         *    non-blocklisted entries with similarity >= FACE_SIMILARITY_THRESHOLD.
         * 4. For each candidate, looks up the Verification record by vendor_data.
         * 5. On a hit, fetches the *matched* session's full decision to extract
         *    id_verifications[0] (the original provisioning session had an ID doc scan).
         * 6. Returns { success, w3id, uri, idVerif } or { success: false, reason }.
         */
        app.post("/recovery/face-search", async (req: Request, res: Response) => {
            const { diditSessionId } = req.body as { diditSessionId?: string };
            if (!diditSessionId) {
                return res.status(400).json({ error: "diditSessionId is required" });
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
                    `/v3/session/${diditSessionId}/decision/`,
                    { headers: { "x-api-key": apiKey } },
                );

                const liveness = decision?.liveness_checks?.[0];
                if (!liveness || liveness.status?.toLowerCase() !== "approved") {
                    console.warn("[RECOVERY] Liveness not approved:", liveness?.status);
                    return res.json({ success: false, reason: "liveness_failed" });
                }

                // Filter to quality candidates only
                const candidates: any[] = (liveness.matches ?? []).filter(
                    (m: any) =>
                        m.status?.toLowerCase() === "approved" &&
                        !m.is_blocklisted &&
                        (m.similarity_percentage ?? 0) >= FACE_SIMILARITY_THRESHOLD,
                );

                for (const match of candidates) {
                    const vendorData: string = match.vendor_data ?? "";
                    if (!vendorData) continue;

                    const record = await this.verificationService.findOne({ id: vendorData });
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
                        `[RECOVERY] eVault found: eName=${record.linkedEName} similarity=${match.similarity_percentage}%`,
                    );

                    return res.json({
                        success: true,
                        w3id: record.linkedEName,
                        uri: evaultUrl,
                        idVerif: idVerif
                            ? {
                                  full_name: idVerif.full_name,
                                  first_name: idVerif.first_name,
                                  last_name: idVerif.last_name,
                                  date_of_birth: idVerif.date_of_birth,
                                  document_type: idVerif.document_type,
                                  document_number: idVerif.document_number,
                                  issuing_state_name: idVerif.issuing_state_name,
                                  issuing_state: idVerif.issuing_state,
                                  expiration_date: idVerif.expiration_date,
                                  date_of_issue: idVerif.date_of_issue,
                              }
                            : null,
                    });
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
