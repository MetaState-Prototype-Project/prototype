import crypto from "crypto";
import { CharterSignatureService } from "./CharterSignatureService";

export interface CharterSigningSession {
    sessionId: string;
    groupId: string;
    charterData: any;
    userId: string;
    qrData: string;
    createdAt: Date;
    expiresAt: Date;
    status: "pending" | "signed" | "expired" | "completed";
}

export interface SignedCharterPayload {
    sessionId: string;
    signature: string;
    publicKey: string;
    message: string;
}

export interface CharterSigningResult {
    success: boolean;
    sessionId: string;
    groupId: string;
    userId: string;
    signature: string;
    publicKey: string;
    message: string;
    type: "signed";
}

export class CharterSigningService {
    private sessions: Map<string, CharterSigningSession> = new Map();
    private signatureService = new CharterSignatureService();

    async createSession(groupId: string, charterData: any, userId: string): Promise<CharterSigningSession> {
        const sessionId = crypto.randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

        // Create generic signature request data
        const messageData = JSON.stringify({
            message: `Sign charter for group: ${groupId}`,
            sessionId: sessionId
        });
        
        const base64Data = Buffer.from(messageData).toString('base64');
        const apiBaseUrl = process.env.PUBLIC_GROUP_CHARTER_BASE_URL || "http://localhost:3003";
        const redirectUri = `${apiBaseUrl}/api/signing/callback`;
        
        const qrData = `w3ds://sign?session=${sessionId}&data=${base64Data}&redirect_uri=${encodeURIComponent(redirectUri)}`;

        const session: CharterSigningSession = {
            sessionId,
            groupId,
            charterData,
            userId,
            qrData,
            createdAt: now,
            expiresAt,
            status: "pending"
        };

        this.sessions.set(sessionId, session);
        console.log(`Created session ${sessionId}, total sessions: ${this.sessions.size}`);

        // Set up expiration cleanup
        setTimeout(() => {
            const session = this.sessions.get(sessionId);
            if (session && session.status === "pending") {
                session.status = "expired";
                this.sessions.set(sessionId, session);
            }
        }, 15 * 60 * 1000);

        return session;
    }

    async getSession(sessionId: string): Promise<CharterSigningSession | null> {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return null;
        }

        // Check if session has expired
        if (session.status === "pending" && new Date() > session.expiresAt) {
            session.status = "expired";
            this.sessions.set(sessionId, session);
        }

        return session;
    }

    async processSignedPayload(sessionId: string, signature: string, publicKey: string, message: string): Promise<CharterSigningResult> {
        console.log(`Processing signed payload for session: ${sessionId}`);
        console.log(`Available sessions:`, Array.from(this.sessions.keys()));
        
        const session = await this.getSession(sessionId);
        
        if (!session) {
            console.log(`Session ${sessionId} not found in available sessions`);
            throw new Error("Session not found");
        }

        if (session.status !== "pending") {
            throw new Error("Session is not in pending state");
        }

        // Verify the signature (basic verification for now)
        // In a real implementation, you would verify the cryptographic signature
        if (!signature || !publicKey || !message) {
            throw new Error("Invalid signature data");
        }

        // 🔐 SECURITY ASSERTION: Verify that the publicKey matches the user's ename who created the session
        try {
            const { UserService } = await import('./UserService');
            const userService = new UserService();
            const user = await userService.getUserById(session.userId);
            
            if (!user) {
                throw new Error("User not found for session");
            }

            // Strip @ prefix from both enames before comparison
            const cleanPublicKey = publicKey.replace(/^@/, '');
            const cleanUserEname = user.ename.replace(/^@/, '');
            
            if (cleanPublicKey !== cleanUserEname) {
                console.error(`🔒 SECURITY VIOLATION: publicKey mismatch!`, {
                    publicKey,
                    userEname: user.ename,
                    cleanPublicKey,
                    cleanUserEname,
                    sessionUserId: session.userId
                });
                throw new Error("Public key does not match the user who created this signing session");
            }
            
            console.log(`✅ Public key verification passed: ${cleanPublicKey} matches ${cleanUserEname}`);
        } catch (error) {
            console.error("Error during public key verification:", error);
            throw new Error("Failed to verify public key: " + (error instanceof Error ? error.message : "Unknown error"));
        }

        // Record the signature in the database
        try {
            await this.signatureService.recordSignature(
                session.groupId,
                session.userId,
                session.charterData.charter,
                signature,
                publicKey,
                message
            );
        } catch (error) {
            console.error("Failed to record signature:", error);
            throw new Error("Failed to record signature");
        }

        // Update session status
        session.status = "completed";
        this.sessions.set(sessionId, session);

        const result: CharterSigningResult = {
            success: true,
            sessionId,
            groupId: session.groupId,
            userId: session.userId,
            signature,
            publicKey,
            message,
            type: "signed"
        };

        return result;
    }

    async getSessionStatus(sessionId: string): Promise<CharterSigningSession | null> {
        return this.getSession(sessionId);
    }

    testConnection(): boolean {
        return true;
    }
} 