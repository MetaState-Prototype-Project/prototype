import { Request, Response } from "express";
import { SigningService } from "../services/SigningService";

export class SigningController {
    private signingService: SigningService | null = null;

    constructor() {
        try {
            this.signingService = new SigningService();
            console.log("SigningController initialized successfully");
        } catch (error) {
            console.error("Failed to initialize SigningController:", error);
            this.signingService = null;
        }
    }

    private ensureService(): SigningService {
        if (!this.signingService) {
            throw new Error("SigningService not initialized");
        }
        return this.signingService;
    }

    // Test method to verify the service is working
    testConnection(): boolean {
        try {
            if (!this.signingService) {
                return false;
            }
            return this.signingService.testConnection();
        } catch (error) {
            console.error("Test connection failed:", error);
            return false;
        }
    }

    // Create a new signing session for a vote
    async createSigningSession(req: Request, res: Response) {
        try {
            const { pollId, voteData, userId } = req.body;
            
            if (!pollId || !voteData || !userId) {
                return res.status(400).json({
                    error: "Missing required fields: pollId, voteData, userId"
                });
            }

            const session = await this.ensureService().createSession(pollId, voteData, userId);
            
            res.status(201).json({
                sessionId: session.id,
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
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({ error: "Session ID required" });
        }

        // Set SSE headers
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Cache-Control"
        });

        // Send initial connection message
        res.write("data: " + JSON.stringify({ type: "connected", sessionId }) + "\n\n");

        // Subscribe to session updates
        const unsubscribe = this.ensureService().subscribeToSession(sessionId, (data) => {
            res.write("data: " + JSON.stringify(data) + "\n\n");
        });

        // Handle client disconnect
        req.on("close", () => {
            unsubscribe();
            res.end();
        });
    }

    // Handle signed payload callback from eID Wallet
    async handleSignedPayload(req: Request, res: Response) {
        try {
            const { sessionId, signature, publicKey, message } = req.body;
            
            if (!sessionId || !signature || !publicKey || !message) {
                const missingFields = [];
                if (!sessionId) missingFields.push('sessionId');
                if (!signature) missingFields.push('signature');
                if (!publicKey) missingFields.push('publicKey');
                if (!message) missingFields.push('message');
                
                return res.status(400).json({
                    error: "Missing required fields",
                    missing: missingFields
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
                res.status(200).json({ 
                    success: true, 
                    message: "Signature verified and vote submitted",
                    voteId: result.voteId
                });
            } else {
                // Always send 200 response to the wallet, even for security violations
                // This prevents the wallet from thinking the request failed
                res.status(200).json({ 
                    success: false, 
                    error: result.error,
                    message: "Request processed but vote not submitted due to verification failure"
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
                return res.status(400).json({ error: "Session ID required" });
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