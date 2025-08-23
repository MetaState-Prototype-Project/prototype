import { Request, Response } from "express";
import { CharterSigningService } from "../services/CharterSigningService";

export class CharterSigningController {
    private signingService: CharterSigningService | null = null;

    constructor() {
        try {
            this.signingService = new CharterSigningService();
            console.log("CharterSigningController initialized successfully");
        } catch (error) {
            console.error("Failed to initialize CharterSigningService:", error);
            this.signingService = null;
        }
    }

    private ensureService(): CharterSigningService {
        if (!this.signingService) {
            throw new Error("CharterSigningService not initialized");
        }
        return this.signingService;
    }

    testConnection(): boolean {
        if (!this.signingService) {
            return false;
        }
        return this.signingService.testConnection();
    }

    // Create a new signing session for a charter
    async createSigningSession(req: Request, res: Response) {
        try {
            const { groupId, charterData } = req.body;
            const userId = (req as any).user?.id;

            if (!groupId || !charterData || !userId) {
                return res.status(400).json({ 
                    error: "Missing required fields: groupId, charterData, or userId" 
                });
            }

            const session = await this.ensureService().createSession(groupId, charterData, userId);
            
            res.json({
                sessionId: session.sessionId,
                qrData: session.qrData,
                expiresAt: session.expiresAt
            });
        } catch (error) {
            console.error("Error creating signing session:", error);
            res.status(500).json({ error: "Failed to create signing session" });
        }
    }

    // Get signing session status via SSE
    async getSigningSessionStatus(req: Request, res: Response) {
        try {
            const { sessionId } = req.params;
            
            if (!sessionId) {
                return res.status(400).json({ error: "Session ID is required" });
            }

            // Set up SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Cache-Control'
            });

            // Send initial status
            const session = await this.ensureService().getSessionStatus(sessionId);
            if (session) {
                res.write(`data: ${JSON.stringify({ type: "status", status: session.status })}\n\n`);
            }

            // Poll for status changes
            const interval = setInterval(async () => {
                const session = await this.ensureService().getSessionStatus(sessionId);
                
                if (session) {
                    if (session.status === "completed") {
                        res.write(`data: ${JSON.stringify({ 
                            type: "signed", 
                            status: "completed",
                            groupId: session.groupId
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

            // Clean up on client disconnect
            req.on('close', () => {
                clearInterval(interval);
                res.end();
            });

        } catch (error) {
            console.error("Error getting signing session status:", error);
            res.status(500).json({ error: "Failed to get signing session status" });
        }
    }

    // Handle signed payload callback from eID Wallet
    async handleSignedPayload(req: Request, res: Response) {
        try {
            const { sessionId, signature, publicKey, message } = req.body;
            
            // Validate required fields
            const missingFields = [];
            if (!sessionId) missingFields.push('sessionId');
            if (!signature) missingFields.push('signature');
            if (!publicKey) missingFields.push('publicKey');
            if (!message) missingFields.push('message');

            if (missingFields.length > 0) {
                return res.status(400).json({ 
                    error: `Missing required fields: ${missingFields.join(', ')}` 
                });
            }

            // Process the signed payload
            const result = await this.ensureService().processSignedPayload(
                sessionId,
                signature,
                publicKey,
                message
            );

            if (result.success) {
                res.json({
                    success: true,
                    message: "Signature verified and charter signed",
                    data: result
                });
            } else {
                // Always send 200 response to the wallet, even for security violations
                // This prevents the wallet from thinking the request failed
                res.status(200).json({
                    success: false,
                    error: result.error,
                    message: "Request processed but charter not signed due to verification failure"
                });
            }

        } catch (error) {
            console.error("Error processing signed payload:", error);
            res.status(500).json({ error: "Failed to process signed payload" });
        }
    }

    // Get signing session by ID
    async getSigningSession(req: Request, res: Response) {
        try {
            const { sessionId } = req.params;
            
            if (!sessionId) {
                return res.status(400).json({ error: "Session ID is required" });
            }

            const session = await this.ensureService().getSession(sessionId);
            
            if (!session) {
                return res.status(404).json({ error: "Session not found" });
            }

            res.json(session);

        } catch (error) {
            console.error("Error getting signing session:", error);
            res.status(500).json({ error: "Failed to get signing session" });
        }
    }
} 