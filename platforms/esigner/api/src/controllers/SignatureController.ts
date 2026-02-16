import { Request, Response } from "express";
import { SignatureService } from "../services/SignatureService";

export class SignatureController {
    private signatureService: SignatureService;

    constructor() {
        this.signatureService = new SignatureService();
    }

    createSigningSession = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { fileId } = req.body;

            if (!fileId) {
                return res.status(400).json({ error: "fileId is required" });
            }

            const session = await this.signatureService.createSession(fileId, req.user.id);

            res.json({
                sessionId: session.sessionId,
                qrData: session.qrData,
                expiresAt: session.expiresAt
            });
        } catch (error) {
            console.error("Error creating signing session:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to create signing session" });
        }
    };

    getSigningSessionStatus = async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({ error: "Session ID is required" });
            }

            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            const session = await this.signatureService.getSessionStatus(id);
            if (session) {
                res.write(`data: ${JSON.stringify({ type: "status", status: session.status })}\n\n`);
            }

            const interval = setInterval(async () => {
                const session = await this.signatureService.getSessionStatus(id);

                if (session) {
                    if (session.status === "completed") {
                        res.write(`data: ${JSON.stringify({
                            type: "signed",
                            status: "completed",
                            fileId: session.fileId
                        })}\n\n`);
                        clearInterval(interval);
                        res.end();
                    } else if (session.status === "expired") {
                        res.write(`data: ${JSON.stringify({ type: "expired" })}\n\n`);
                        clearInterval(interval);
                        res.end();
                    } else if (session.status === "security_violation") {
                        res.write(`data: ${JSON.stringify({ type: "security_violation" })}\n\n`);
                        clearInterval(interval);
                        res.end();
                    }
                } else {
                    res.write(`data: ${JSON.stringify({ type: "error", message: "Session not found" })}\n\n`);
                    clearInterval(interval);
                    res.end();
                }
            }, 1000);

            req.on('close', () => {
                clearInterval(interval);
                res.end();
            });

        } catch (error) {
            console.error("Error getting signing session status:", error);
            res.status(500).json({ error: "Failed to get signing session status" });
        }
    };

    handleSignedPayload = async (req: Request, res: Response) => {
        try {
            const { sessionId, signature, w3id, message } = req.body;

            const missingFields = [];
            if (!sessionId) missingFields.push('sessionId');
            if (!signature) missingFields.push('signature');
            if (!w3id) missingFields.push('w3id');
            if (!message) missingFields.push('message');

            if (missingFields.length > 0) {
                return res.status(400).json({
                    error: `Missing required fields: ${missingFields.join(', ')}`
                });
            }

            const result = await this.signatureService.processSignedPayload(
                sessionId,
                signature,
                w3id,
                message
            );

            if (result.success) {
                res.json({
                    success: true,
                    message: "Signature verified and stored",
                    data: result
                });
            } else {
                res.status(200).json({
                    success: false,
                    error: result.error,
                    message: "Request processed but signature not stored due to verification failure"
                });
            }

        } catch (error) {
            console.error("Error processing signed payload:", error);
            res.status(500).json({ error: "Failed to process signed payload" });
        }
    };
}


