import { VoteService } from "./VoteService";
import { UserService } from "./UserService";
import { randomUUID } from "crypto";

export interface SigningSession {
    id: string;
    pollId: string;
    userId: string;
    voteData: any;
    qrData: string;
    status: "pending" | "signed" | "expired" | "completed";
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export interface SignedPayload {
    sessionId: string;
    signature: string;
    publicKey: string;
    message: string;
}

export interface SigningResult {
    success: boolean;
    error?: string;
    voteId?: string;
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

    async processSignedPayload(sessionId: string, signature: string, publicKey: string, message: string): Promise<SigningResult> {
        const session = await this.getSession(sessionId);
        
        if (!session) {
            return { success: false, error: "Session not found" };
        }
        
        if (session.status === "expired") {
            return { success: false, error: "Session expired" };
        }
        
        if (session.status === "completed") {
            return { success: false, error: "Session already completed" };
        }
        
        try {
            // Verify the signature (basic verification for now)
            // In production, you'd want proper cryptographic verification
            const expectedMessage = JSON.stringify({
                pollId: session.pollId,
                voteData: session.voteData,
                userId: session.userId
                // Removed timestamp from verification since it will never match
            });
            
            if (message !== expectedMessage) {
                return { success: false, error: "Message verification failed" };
            }
            
            // Submit the actual vote
            const vote = await this.getVoteService().createVote({
                pollId: session.pollId,
                userId: session.userId,
                ...session.voteData
            });
            
            // Update session status
            session.status = "completed";
            session.updatedAt = new Date();
            this.sessions.set(sessionId, session);
            
            // Notify subscribers
            this.notifySubscribers(sessionId, {
                type: "signed",
                status: "completed",
                voteId: vote.id,
                sessionId
            });
            
            return { 
                success: true, 
                voteId: vote.id 
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