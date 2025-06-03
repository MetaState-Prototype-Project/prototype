import { Request, Response } from "express";
import { VerificationService } from "../services/VerificationService";
import { eventEmitter } from "../utils/eventEmitter";
import { createHmacSignature } from "../utils/hmac";
import { default as Axios } from "axios";

const veriffClient = Axios.create({
    baseURL: "https://stationapi.veriff.com",
    withCredentials: true,
});

veriffClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async function (error) {
        if (!error.response) return Promise.reject(error);
        return Promise.reject(error);
    },
);

export class VerificationController {
    constructor(private readonly verificationService: VerificationService) {}

    registerRoutes(app: any) {
        // SSE endpoint for verification status updates

        app.get(
            "/verification/sessions/:id",
            async (req: Request, res: Response) => {
                const { id } = req.params;

                // Set headers for SSE
                res.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                });

                // Initial heartbeat to keep connection open
                res.write(
                    `event: connected\ndata: ${JSON.stringify({ hi: "hi" })}\n\n`,
                );

                const handler = (data: any) => {
                    console.log("hi?");
                    res.write(`data: ${JSON.stringify(data)}\n\n`);
                };

                eventEmitter.on(id, handler);

                // Handle client disconnect
                req.on("close", () => {
                    eventEmitter.off(id, handler);
                    res.end();
                });

                req.on("error", (error) => {
                    console.error("SSE Error:", error);
                    eventEmitter.off(id, handler);
                    res.end();
                });
            },
        );

        app.post(
            "/verification/:id/media",
            async (req: Request, res: Response) => {
                const { img, type } = req.body;
                const types = ["document-front", "document-back", "face"];
                if (!types.includes(type))
                    throw new Error(
                        `Wrong type specified, accepted types are ${types}`,
                    );
                const verification = await this.verificationService.findById(
                    req.params.id,
                );
                if (!verification) throw new Error("Verification not found");
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
                await veriffClient.post(
                    `/v1/sessions/${verification.veriffId}/media`,
                    veriffBody,
                    {
                        headers: {
                            "X-HMAC-SIGNATURE": signature,
                            "X-AUTH-CLIENT": process.env.PUBLIC_VERIFF_KEY,
                        },
                    },
                );
                res.sendStatus(201);
            },
        );

        // Get verification session
        app.get("/verification/:id", async (req: Request, res: Response) => {
            const { id } = req.params;
            const session = await this.verificationService.findById(id);
            if (!session) {
                return res
                    .status(404)
                    .json({ error: "Verification session not found" });
            }
            return res.json(session);
        });

        // Create new verification
        app.post("/verification", async (req: Request, res: Response) => {
            const { referenceId } = req.body;

            if (referenceId) {
                const existing = await this.verificationService.findOne({
                    referenceId,
                });
                if (existing) {
                    return res
                        .status(409)
                        .json({ error: "Reference ID Already Exists" });
                }
            }

            const verification = await this.verificationService.create({
                referenceId,
            });
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
                veriffId: veriffSession.verification.id,
            });

            return res.status(201).json(verification);
        });

        app.patch("/verification/:id", async (req: Request, res: Response) => {
            const verification = await this.verificationService.findById(
                req.params.id,
            );
            const body = {
                verification: {
                    status: "submitted",
                },
            };
            const signature = createHmacSignature(
                body,
                process.env.VERIFF_HMAC_KEY as string,
            );
            await veriffClient.patch(
                `/v1/sessions/${verification?.veriffId}`,
                body,
                {
                    headers: {
                        "X-HMAC-SIGNATURE": signature,
                        "X-AUTH-CLIENT": process.env.PUBLIC_VERIFF_KEY,
                    },
                },
            );
            res.sendStatus(201);
        });

        // Webhook for verification decisions
        app.post(
            "/verification/decisions",
            async (req: Request, res: Response) => {
                const body = req.body;
                console.log(body);
                const id = body.vendorData;

                const verification =
                    await this.verificationService.findById(id);
                if (!verification) {
                    return res
                        .status(404)
                        .json({ error: "Verification not found" });
                }

                let status = body.data.verification.decision;
                let reason = body.data.verification.decision;

                const affirmativeStatusTypes = [
                    "approved",
                    "declined",
                    "expired",
                    "abandoned",
                ];
                if (
                    affirmativeStatusTypes.includes(
                        body.data.verification.decision,
                    )
                ) {
                    let approved =
                        body.data.verification.decision === "approved";
                    if (process.env.DUPLICATES_POLICY !== "allow") {
                        const verificationMatch =
                            await this.verificationService.findOne({
                                documentId:
                                body.data.verification.document.number.value
                            });
                        console.log("matched", verificationMatch)
                        if (verificationMatch) {
                            approved = false;
                            status = "declined";
                            reason =
                                "Document already used to create an eVault";
                        }
                    }
                    await this.verificationService.findByIdAndUpdate(id, {
                        approved,
                        data: {
                            person: body.data.verification.person,
                            document: body.data.verification.document,
                        },
                        documentId:
                            body.data.verification.document.number.value,
                    });
                }

                eventEmitter.emit(id, {
                    reason,
                    status,
                    person: body.data.verification.person ?? null,
                    document: body.data.verification.document,
                });

                return res.json({ success: true });
            },
        );
    }
}
