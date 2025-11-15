import { VoteService } from "./VoteService";
import { UserService } from "./UserService";
import { randomUUID } from "crypto";

export interface SigningSession {
    id: string;
    pollId: string;
    userId: string;
    voteData: any;
    qrData: string;
    status: "pending" | "signed" | "expired" | "completed" | "security_violation";
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface SignedPayload {
    sessionId: string;
    signature: string;
    w3id: string;
    message: string;
}

export interface SigningResult {
    success: boolean;
    error?: string;
    voteId?: string;
    voteResult?: any; // For blind voting results
}

export class SigningService {
    private sessions: Map<string, SigningSession> = new Map();
    private subscribers: Map<string, Set<(data: any) => void>> = new Map();
    private voteService: VoteService;
    private userService: UserService;

    constructor() {
        // Initialize services lazily to avoid database connection issues
        this.voteService = null as any;
        this.userService = null as any;
        
        // Clean up expired sessions every hour
        setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
        
    }

    private getVoteService(): VoteService {
        if (!this.voteService) {
            this.voteService = new VoteService();
        }
        return this.voteService;
    }

    private getUserService(): UserService {
        if (!this.userService) {
            this.userService = new UserService();
        }
        return this.userService;
    }

    // Simple test method that doesn't require database
    testConnection(): boolean {
        return true;
    }

    async createSession(pollId: string, voteData: any, userId: string): Promise<SigningSession> {
        const sessionId = randomUUID();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        // Create QR data with w3ds:// URI scheme
        const messageData = JSON.stringify({
            pollId,
            voteData,
            userId,
            timestamp: Date.now()
        });
        
        const base64Data = Buffer.from(messageData).toString('base64');
        // Use the existing EVOTING_BASE_URL environment variable for the callback
        const apiBaseUrl = process.env.PUBLIC_EVOTING_BASE_URL || 'http://localhost:7777';
        const redirectUri = `${apiBaseUrl}/api/signing/callback`;
        
        const qrData = `w3ds://sign?session=${sessionId}&data=${base64Data}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        const session: SigningSession = {
            id: sessionId,
            pollId,
            userId,
            voteData,
            qrData,
            status: "pending",
            expiresAt,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        this.sessions.set(sessionId, session);
        return session;
    }

    async getSession(sessionId: string): Promise<SigningSession | null> {
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        
        // Check if expired
        if (new Date() > session.expiresAt) {
            session.status = "expired";
            session.updatedAt = new Date();
            this.sessions.set(sessionId, session);
        }
        
        return session;
    }

    async processSignedPayload(sessionId: string, signature: string, w3id: string, message: string): Promise<SigningResult> {
        console.log("🔐 Processing signed payload:", {
            sessionId,
            w3id,
            hasSignature: !!signature,
            hasMessage: !!message
        });
        
        const session = await this.getSession(sessionId);
        
        if (!session) {
            console.error("❌ Session not found:", sessionId);
            return { success: false, error: "Session not found" };
        }
        
        console.log("📋 Session found:", {
            sessionId: session.id,
            status: session.status,
            pollId: session.pollId,
            userId: session.userId
        });
        
        if (session.status === "expired") {
            console.error("❌ Session expired");
            return { success: false, error: "Session expired" };
        }
        
        if (session.status === "completed") {
            console.error("❌ Session already completed");
            return { success: false, error: "Session already completed" };
        }
        
        try {
            // 🔐 SECURITY ASSERTION: Verify that the w3id matches the user's ename who created the session
            try {
                const { UserService } = await import('./UserService');
                const userService = new UserService();
                const user = await userService.getUserById(session.userId);
                
                if (!user) {
                    return { success: false, error: "User not found for session" };
                }

                // Strip @ prefix from both enames before comparison
                const cleanW3id = w3id.replace(/^@/, '');
                const cleanUserEname = user.ename.replace(/^@/, '');
                
                if (cleanW3id !== cleanUserEname) {
                    console.error(`🔒 SECURITY VIOLATION: w3id mismatch!`, {
                        w3id,
                        userEname: user.ename,
                        cleanW3id,
                        cleanUserEname,
                        sessionUserId: session.userId
                    });
                    
                    // Update session status to indicate security violation
                    session.status = "security_violation";
                    session.updatedAt = new Date();
                    this.sessions.set(sessionId, session);
                    
                    // Notify subscribers of security violation
                    this.notifySubscribers(sessionId, {
                        type: "security_violation",
                        status: "security_violation",
                        error: "W3ID does not match the user who created this signing session",
                        sessionId
                    });
                    
                    // Return success: false but don't throw error - let the wallet think it succeeded
                    return { success: false, error: "W3ID does not match the user who created this signing session" };
                }
                
                console.log(`✅ W3ID verification passed: ${cleanW3id} matches ${cleanUserEname}`);
            } catch (error) {
                console.error("Error during w3id verification:", error);
                return { success: false, error: "Failed to verify w3id: " + (error instanceof Error ? error.message : "Unknown error") };
            }

            // Verify the signature (basic verification for now)
            // In production, you'd want proper cryptographic verification
            // Parse the received message and check only the fields we care about
            let parsedMessage;
            try {
                parsedMessage = JSON.parse(message);
            } catch (error) {
                console.error("❌ Failed to parse message as JSON:", message);
                return { success: false, error: "Invalid message format" };
            }
            
            console.log("🔍 Message verification:", {
                receivedMessage: message,
                parsedMessage
            });
            
            // Compare only the fields that matter (ignore extra fields like sessionId, timestamp)
            const pollIdMatches = parsedMessage.pollId === session.pollId;
            const userIdMatches = parsedMessage.userId === session.userId;
            const voteDataMatches = JSON.stringify(parsedMessage.voteData) === JSON.stringify(session.voteData);
            
            console.log("🔍 Field comparison:", {
                pollIdMatches,
                userIdMatches,
                voteDataMatches,
                expected: {
                    pollId: session.pollId,
                    userId: session.userId,
                    voteData: session.voteData
                },
                received: {
                    pollId: parsedMessage.pollId,
                    userId: parsedMessage.userId,
                    voteData: parsedMessage.voteData
                }
            });
            
            if (!pollIdMatches || !userIdMatches || !voteDataMatches) {
                console.error("❌ Message verification failed!");
                return { success: false, error: "Message verification failed" };
            }
            
            console.log("✅ Message verification passed!");
            
            // Check if this is a blind vote or regular vote by looking at the poll
            console.log("📊 Fetching poll information...");
            const pollService = new (await import('./PollService')).PollService();
            const poll = await pollService.getPollById(session.pollId);
            
            if (!poll) {
                console.error("❌ Poll not found:", session.pollId);
                return { success: false, error: "Poll not found" };
            }
            
            console.log("📊 Poll found:", { pollId: poll.id, visibility: poll.visibility });
            
            let voteResult;
            
            if (poll.visibility === "private") {
                console.log("🔒 Submitting blind vote...");
                // Blind voting - submit using blind vote method
                voteResult = await this.getVoteService().submitBlindVote(
                    session.pollId,
                    session.userId,
                    {
                        chosenOptionId: session.voteData.optionId || 'option_0',
                        commitments: session.voteData.commitments || {},
                        anchors: session.voteData.anchors || {}
                    }
                );
                console.log("✅ Blind vote submitted:", voteResult);
            } else {
                console.log("📝 Submitting regular vote...");
                // Regular voting - submit using regular vote method
                const mode = session.voteData.optionId !== undefined ? "normal" : 
                           session.voteData.points ? "point" : "rank";
                
                console.log("Vote mode:", mode, "voteData:", session.voteData);
                
                voteResult = await this.getVoteService().createVote(
                    session.pollId,
                    session.userId,
                    session.voteData,
                    mode
                );
                console.log("✅ Regular vote submitted:", voteResult);
            }
            
            // Update session status
            console.log("📝 Updating session status to completed...");
            session.status = "completed";
            session.updatedAt = new Date();
            this.sessions.set(sessionId, session);
            
            // Notify subscribers
            console.log("📢 Notifying subscribers...", {
                sessionId,
                subscribersCount: this.subscribers.get(sessionId)?.size || 0
            });
            
            this.notifySubscribers(sessionId, {
                type: "signed",
                status: "completed",
                voteResult,
                sessionId
            });
            
            console.log("✅ Vote processing completed successfully!");
            
            return { 
                success: true, 
                voteResult
            };
            
        } catch (error) {
            console.error("Error processing signed payload:", error);
            
            // Log more details about the error
            if (error instanceof Error) {
                console.error("Error details:", {
                    message: error.message,
                    stack: error.stack,
                    sessionId,
                    pollId: session?.pollId,
                    userId: session?.userId
                });
            }
            
            return { success: false, error: `Failed to process vote: ${error instanceof Error ? error.message : String(error)}` };
        }
    }

    subscribeToSession(sessionId: string, callback: (data: any) => void): () => void {
        if (!this.subscribers.has(sessionId)) {
            this.subscribers.set(sessionId, new Set());
        }
        
        this.subscribers.get(sessionId)!.add(callback);
        
        // Return unsubscribe function
        return () => {
            const sessionSubscribers = this.subscribers.get(sessionId);
            if (sessionSubscribers) {
                sessionSubscribers.delete(callback);
                if (sessionSubscribers.size === 0) {
                    this.subscribers.delete(sessionId);
                }
            }
        };
    }

    private notifySubscribers(sessionId: string, data: any): void {
        const sessionSubscribers = this.subscribers.get(sessionId);
        if (sessionSubscribers) {
            sessionSubscribers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error("Error in subscriber callback:", error);
                }
            });
        }
    }

    private cleanupExpiredSessions(): void {
        const now = new Date();
        for (const [sessionId, session] of this.sessions.entries()) {
            if (now > session.expiresAt && session.status === "pending") {
                session.status = "expired";
                session.updatedAt = now;
                this.sessions.set(sessionId, session);
                
                // Notify subscribers of expiration
                this.notifySubscribers(sessionId, {
                    type: "expired",
                    status: "expired",
                    sessionId
                });
            }
        }
    }
} 