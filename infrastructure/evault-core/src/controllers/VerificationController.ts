import { Request, Response } from "express";
import { default as Axios } from "axios";
import { validate as uuidValidate } from "uuid";
import { VerificationService } from "../services/VerificationService";
import type { ProvisioningService } from "../services/ProvisioningService";

const diditClient = Axios.create({
    baseURL: "https://verification.didit.me",
});

function requireSharedSecret(req: Request, res: Response): boolean {
    const secret = process.env.PROVISIONER_SHARED_SECRET;
    if (!secret) {
        console.warn("[AUTH] PROVISIONER_SHARED_SECRET not set — rejecting request");
        res.status(500).json({ error: "Server misconfiguration: shared secret not set" });
        return false;
    }
    const provided = req.headers["x-shared-secret"];
    if (!provided || provided !== secret) {
        res.status(401).json({ error: "Unauthorized: invalid or missing shared secret" });
        return false;
    }
    return true;
}

export class VerificationController {
    constructor(
        private readonly verificationService: VerificationService,
        private readonly provisioningService?: ProvisioningService,
    ) {}

    registerRoutes(app: any) {
        // Get verification session
        app.get("/verification/:id", async (req: Request, res: Response) => {
            if (!requireSharedSecret(req, res)) return;
            const { id } = req.params;
            const session = await this.verificationService.findById(id);
            if (!session) {
                return res.status(404).json({ error: "Verification session not found" });
            }
            return res.json(session);
        });

        // Create new Didit verification session
        app.post("/verification", async (req: Request, res: Response) => {
            if (!requireSharedSecret(req, res)) return;
            console.log("Creating new Didit verification session");
            const { referenceId } = req.body;

            if (referenceId) {
                const existing = await this.verificationService.findOne({ referenceId });
                if (existing) {
                    return res.status(409).json({ error: "Reference ID Already Exists" });
                }
            }

            const verification = await this.verificationService.create({ referenceId });

            const apiKey = process.env.DIDIT_API_KEY;
            const workflowId = process.env.DIDIT_WORKFLOW_ID;
            if (!apiKey || !workflowId) {
                return res.status(500).json({ error: "Didit API key or workflow ID not configured" });
            }

            let diditSession: any;
            try {
                const response = await diditClient.post(
                    "/v3/session/",
                    {
                        workflow_id: workflowId,
                        vendor_data: verification.id,
                    },
                    {
                        headers: {
                            "x-api-key": apiKey,
                            "Content-Type": "application/json",
                        },
                    },
                );
                diditSession = response.data;
            } catch (err: any) {
                console.error(
                    "[DIDIT SESSION CREATE]",
                    err?.response?.data ?? err?.message,
                );
                return res
                    .status(502)
                    .json({ error: "Failed to create Didit session" });
            }

            console.log("[Didit] Session response:", JSON.stringify(diditSession));

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

            return res.status(201).json({
                id: verification.id,
                sessionToken,
                verificationUrl,
            });
        });

        // Upgrade existing eVault: create binding docs + update UserProfile after KYC
        app.post("/verification/upgrade", async (req: Request, res: Response) => {
            if (!requireSharedSecret(req, res)) return;
            const { diditSessionId, w3id } = req.body;
            if (!diditSessionId || !w3id) {
                return res.status(400).json({ error: "diditSessionId and w3id are required" });
            }
            if (!this.provisioningService) {
                return res.status(500).json({ error: "Provisioning service not available" });
            }
            try {
                const result = await this.provisioningService.upgradeExistingEVault(diditSessionId, w3id);
                if (!result.success) {
                    return res.status(400).json(result);
                }
                return res.json(result);
            } catch (err: any) {
                console.error("[UPGRADE]", err?.message);
                return res.status(500).json({ error: "Upgrade failed" });
            }
        });

        // Proxy: fetch full decision from Didit API by sessionId
        app.get("/verification/decision/:sessionId", async (req: Request, res: Response) => {
            if (!requireSharedSecret(req, res)) return;
            const { sessionId } = req.params;
            if (!uuidValidate(sessionId)) {
                return res.status(400).json({
                    error: "sessionId must be a valid UUID",
                });
            }
            const apiKey = process.env.DIDIT_API_KEY;
            if (!apiKey) {
                return res.status(500).json({ error: "DIDIT_API_KEY not configured" });
            }
            try {
                const { data } = await diditClient.get(
                    `/v3/session/${encodeURIComponent(sessionId)}/decision/`,
                    { headers: { "x-api-key": apiKey } },
                );
                return res.json(data);
            } catch (err: any) {
                console.error("[DIDIT DECISION]", err?.response?.data ?? err?.message);
                return res.status(err?.response?.status ?? 500).json(
                    err?.response?.data ?? { error: "Failed to fetch decision" },
                );
            }
        });
    }
}
