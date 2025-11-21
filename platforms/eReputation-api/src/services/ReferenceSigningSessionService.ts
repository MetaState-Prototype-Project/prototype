import crypto from "crypto";
import { ReferenceSignatureService } from "./ReferenceSignatureService";

export interface ReferenceSigningSession {
    sessionId: string;
    referenceId: string;
    referenceData: {
        targetType: string;
        targetId: string;
        targetName: string;
        content: string;
        referenceType: string;
        numericScore?: number;
    };
    userId: string;
    qrData: string;
    createdAt: Date;
    expiresAt: Date;
    status: "pending" | "signed" | "expired" | "completed" | "security_violation";
}

export interface SignedReferencePayload {
    sessionId: string;
    signature: string;
    publicKey: string;
    message: string;
}

export interface ReferenceSigningResult {
    success: boolean;
    error?: string;
    sessionId: string;
    referenceId: string;
    userId: string;
    signature?: string;
    publicKey?: string;
    message?: string;
    type: "signed" | "security_violation";
}

export class ReferenceSigningSessionService {
    private sessions: Map<string, ReferenceSigningSession> = new Map();
    private signatureService = new ReferenceSignatureService();

    async createSession(referenceId: string, referenceData: any, userId: string): Promise<ReferenceSigningSession> {
        const sessionId = crypto.randomUUID();
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

        // Create generic signature request data
        const messageData = JSON.stringify({
            message: `Sign reference for ${referenceData.targetType}: ${referenceData.targetName}`,
            sessionId: sessionId,
            referenceId: referenceId
        });

        const base64Data = Buffer.from(messageData).toString('base64');
        const apiBaseUrl = process.env.PUBLIC_EREPUTATION_BASE_URL || "http://localhost:8765";
        const redirectUri = `${apiBaseUrl}/api/references/signing/callback`;

        const qrData = `w3ds://sign?session=${sessionId}&data=${base64Data}&redirect_uri=${encodeURIComponent(redirectUri)}`;

        const session: ReferenceSigningSession = {
            sessionId,
            referenceId,
            referenceData,
            userId,
            qrData,
            createdAt: now,
            expiresAt,
            status: "pending"
        };

        this.sessions.set(sessionId, session);
        console.log(`Created reference signing session ${sessionId}, total sessions: ${this.sessions.size}`);

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

    async getSession(sessionId: string): Promise<ReferenceSigningSession | null> {
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

    async processSignedPayload(sessionId: string, signature: string, publicKey: string, message: string): Promise<ReferenceSigningResult> {
        console.log(`Processing signed payload for reference session: ${sessionId}`);

        const session = await this.getSession(sessionId);

        if (!session) {
            throw new Error("Session not found");
        }

        if (session.status !== "pending") {
            throw new Error("Session is not in pending state");
        }

        // Verify the signature (basic verification for now)
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

                // Update session status to indicate security violation
                session.status = "security_violation";
                this.sessions.set(sessionId, session);

                // Return error result instead of throwing
                return {
                    success: false,
                    error: "Public key does not match the user who created this signing session",
                    sessionId,
                    referenceId: session.referenceId,
                    userId: session.userId,
                    type: "security_violation"
                };
            }

            console.log(`✅ Public key verification passed: ${cleanPublicKey} matches ${cleanUserEname}`);
        } catch (error) {
            console.error("Error during public key verification:", error);
            throw new Error("Failed to verify public key: " + (error instanceof Error ? error.message : "Unknown error"));
        }

        // Record the signature in the database
        try {
            await this.signatureService.recordSignature(
                session.referenceId,
                session.userId,
                session.referenceData.content,
                session.referenceData.targetType,
                session.referenceData.targetId,
                session.referenceData.numericScore,
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

        const result: ReferenceSigningResult = {
            success: true,
            sessionId,
            referenceId: session.referenceId,
            userId: session.userId,
            signature,
            publicKey,
            message,
            type: "signed"
        };

        return result;
    }

    async getSessionStatus(sessionId: string): Promise<ReferenceSigningSession | null> {
        return this.getSession(sessionId);
    }

    testConnection(): boolean {
        return true;
    }
}

