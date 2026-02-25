import { Request, Response } from "express";
import { default as Axios } from "axios";
import { VerificationService } from "../services/VerificationService";
import { eventEmitter } from "../utils/eventEmitter";
import { createHmacSignature } from "../utils/hmac";

const veriffClient = Axios.create({
    baseURL: "https://stationapi.veriff.com",
    withCredentials: true,
});

export class LegacyVerificationController {
    constructor(private readonly verificationService: VerificationService) {}

    private getVeriffId(data: Record<string, unknown> | null | undefined): string {
        const value = data?.veriffId;
        return typeof value === "string" ? value : "";
    }

    registerRoutes(app: any) {
        app.get("/verification/sessions/:id", async (req: Request, res: Response) => {
            const { id } = req.params;

            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
                "Access-Control-Allow-Origin": "*",
            });

            res.write(
                `event: connected\ndata: ${JSON.stringify({
                    hi: "hi",
                })}\n\n`,
            );

            const handler = (payload: unknown) => {
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
            };

            eventEmitter.on(id, handler);

            req.on("close", () => {
                eventEmitter.off(id, handler);
                res.end();
            });

            req.on("error", () => {
                eventEmitter.off(id, handler);
                res.end();
            });
        });

        app.post("/verification/:id/media", async (req: Request, res: Response) => {
            const { img, type } = req.body ?? {};
            const allowedTypes = ["document-front", "document-back", "face"];
            if (!allowedTypes.includes(type)) {
                return res
                    .status(400)
                    .json({ error: `Wrong type specified, accepted types are ${allowedTypes.join(", ")}` });
            }

            const verification = await this.verificationService.findById(req.params.id);
            if (!verification) {
                return res.status(404).json({ error: "Verification not found" });
            }

            const veriffId = this.getVeriffId(verification.data as Record<string, unknown>);
            if (!veriffId) {
                return res.status(400).json({ error: "Verification session is not initialized with Veriff" });
            }

            const veriffBody = {
                image: {
                    context: type,
                    content: img,
                },
            };

            const signature = createHmacSignature(
                veriffBody,
                process.env.VERIFF_HMAC_KEY as string,
            );

            await veriffClient.post(`/v1/sessions/${veriffId}/media`, veriffBody, {
                headers: {
                    "X-HMAC-SIGNATURE": signature,
                    "X-AUTH-CLIENT": process.env.PUBLIC_VERIFF_KEY,
                },
            });

            return res.sendStatus(201);
        });

        app.get("/verification/:id", async (req: Request, res: Response) => {
            const { id } = req.params;
            const session = await this.verificationService.findById(id);
            if (!session) {
                return res.status(404).json({ error: "Verification session not found" });
            }
            return res.json(session);
        });

        app.post("/verification", async (req: Request, res: Response) => {
            const { referenceId } = req.body ?? {};

            if (referenceId) {
                const existing = await this.verificationService.findOne({ referenceId });
                if (existing) {
                    return res.status(409).json({ error: "Reference ID Already Exists" });
                }
            }

            const verification = await this.verificationService.create({ referenceId });
            const veriffBody = {
                verification: {
                    vendorData: verification.id,
                },
            };

            const signature = createHmacSignature(
                veriffBody,
                process.env.VERIFF_HMAC_KEY as string,
            );

            const { data: veriffSession } = await veriffClient.post(
                "/v1/sessions",
                veriffBody,
                {
                    headers: {
                        "X-HMAC-SIGNATURE": signature,
                        "X-AUTH-CLIENT": process.env.PUBLIC_VERIFF_KEY,
                    },
                },
            );

            await this.verificationService.findByIdAndUpdate(verification.id, {
                data: {
                    ...(verification.data ?? {}),
                    veriffId: veriffSession?.verification?.id ?? null,
                },
            });

            return res.status(201).json(verification);
        });

        app.patch("/verification/:id", async (req: Request, res: Response) => {
            const verification = await this.verificationService.findById(req.params.id);
            if (!verification) {
                return res.status(404).json({ error: "Verification not found" });
            }

            const veriffId = this.getVeriffId(verification.data as Record<string, unknown>);
            if (!veriffId) {
                return res.status(400).json({ error: "Verification session is not initialized with Veriff" });
            }

            const body = {
                verification: {
                    status: "submitted",
                },
            };

            const signature = createHmacSignature(
                body,
                process.env.VERIFF_HMAC_KEY as string,
            );

            await veriffClient.patch(`/v1/sessions/${veriffId}`, body, {
                headers: {
                    "X-HMAC-SIGNATURE": signature,
                    "X-AUTH-CLIENT": process.env.PUBLIC_VERIFF_KEY,
                },
            });

            return res.sendStatus(201);
        });

        app.post("/verification/decisions", async (req: Request, res: Response) => {
            const body = req.body ?? {};
            const id = body?.vendorData;
            let w3id: string | null = null;

            if (!id || typeof id !== "string") {
                return res.status(400).json({ error: "Missing or invalid vendorData" });
            }

            const verification = await this.verificationService.findById(id);
            if (!verification) {
                return res.status(404).json({ error: "Verification not found" });
            }

            const decision = body?.data?.verification?.decision;
            const person = body?.data?.verification?.person ?? null;
            const document = body?.data?.verification?.document;
            let status = decision;
            let reason = decision;

            const terminalStatuses = ["approved", "declined", "expired", "abandoned"];
            if (terminalStatuses.includes(decision)) {
                const approved = decision === "approved";
                const docNumber = document?.number?.value;

                if (process.env.DUPLICATES_POLICY !== "allow" && typeof docNumber === "string" && docNumber) {
                    const [matches] = await this.verificationService.findManyAndCount({
                        documentId: docNumber,
                    });

                    const verificationMatch = matches.find((match) => !!match.linkedEName);
                    if (verificationMatch) {
                        status = "duplicate";
                        reason = "Document already used to create an eVault";
                        w3id = verificationMatch.linkedEName;
                    }
                }

                await this.verificationService.findByIdAndUpdate(id, {
                    approved,
                    data: {
                        ...(verification.data ?? {}),
                        person,
                        document,
                    },
                    documentId:
                        typeof docNumber === "string" ? docNumber : undefined,
                });
            }

            eventEmitter.emit(id, {
                reason,
                status,
                w3id,
                person,
                document,
            });

            return res.json({ success: true });
        });
    }
}
