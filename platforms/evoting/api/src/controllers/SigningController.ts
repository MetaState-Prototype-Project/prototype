import { Request, Response } from "express";
import { SigningService } from "../services/SigningService";
import type { SigningDelegationContext } from "../services/SigningService";

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
            const { pollId, voteData, userId, delegationContext } = req.body as {
                pollId?: string;
                voteData?: any;
                userId?: string;
                delegationContext?: SigningDelegationContext;
            };
            
            if (!pollId || !voteData || !userId) {
                return res.status(400).json({
                    error: "Missing required fields: pollId, voteData, userId"
                });
            }

            const session = await this.ensureService().createSession(
                pollId,
                voteData,
                userId,
                delegationContext
            );
            
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
        const service = this.ensureService();
        const unsubscribe = service.subscribeToSession(sessionId, (data) => {
            res.write("data: " + JSON.stringify(data) + "\n\n");
        });

        // Clean up the subscription when the client disconnects. Registered before the
        // getSession() await below so a disconnect during that await can't slip past
        // listener registration and leak the subscriber.
        req.on("close", () => {
            unsubscribe();
            res.end();
        });

        // Replay the current terminal state on (re)connect. The completion event is
        // pushed only once, at callback time. On mobile the browser suspends this SSE
        // stream while the eID Wallet is foregrounded, so a client that reconnects
        // after signing would otherwise never learn the vote succeeded (and would show
        // a misleading error or hang until expiry). Re-emitting is idempotent on the client.
        try {
            const session = await service.getSession(sessionId);
            if (session?.status === "completed") {
                res.write("data: " + JSON.stringify({ type: "signed", status: "completed", sessionId }) + "\n\n");
            } else if (session?.status === "security_violation") {
                res.write("data: " + JSON.stringify({ type: "security_violation", status: "security_violation", error: "eName verification failed", sessionId }) + "\n\n");
            } else if (session?.status === "expired") {
                res.write("data: " + JSON.stringify({ type: "expired", status: "expired", sessionId }) + "\n\n");
            }
        } catch (error) {
            console.error("Error replaying signing session status on connect:", error);
        }
    }

    // Handle signed payload callback from eID Wallet
    async handleSignedPayload(req: Request, res: Response) {
        try {
            console.log("📥 Received signed payload callback:", {
                body: req.body,
                headers: req.headers
            });
            
            const { sessionId, signature, w3id, message } = req.body;
            
            if (!sessionId || !signature || !w3id || !message) {
                const missingFields = [];
                if (!sessionId) missingFields.push('sessionId');
                if (!signature) missingFields.push('signature');
                if (!w3id) missingFields.push('w3id');
                if (!message) missingFields.push('message');
                
                console.error("❌ Missing required fields:", missingFields);
                
                return res.status(400).json({
                    error: "Missing required fields",
                    missing: missingFields
                });
            }

            console.log("✅ All required fields present, processing...");
            
            // Process the signed payload
            const result = await this.ensureService().processSignedPayload(
                sessionId, 
                signature, 
                w3id, 
                message
            );
            
            console.log("📤 Processing result:", result);

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