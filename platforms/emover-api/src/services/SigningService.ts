import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";

interface SigningSession {
    id: string;
    migrationId: string;
    data: Record<string, unknown>;
    qrData: string;
    expiresAt: Date;
    signed: boolean;
}

export class SigningService extends EventEmitter {
    private sessions: Map<string, SigningSession> = new Map();

    async createSession(
        migrationId: string,
        data: Record<string, unknown>,
    ): Promise<SigningSession> {
        const sessionId = uuidv4();
        const baseUrl =
            process.env.PUBLIC_EMOVER_BASE_URL || "http://localhost:3000";

        const qrData = `w3ds://sign?redirect=${encodeURIComponent(
            new URL("/api/migration/callback", baseUrl).toString(),
        )}&session=${sessionId}&platform=emover`;

        const session: SigningSession = {
            id: sessionId,
            migrationId,
            data,
            qrData,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
            signed: false,
        };

        this.sessions.set(sessionId, session);

        // Clean up expired sessions
        setTimeout(() => {
            this.sessions.delete(sessionId);
        }, 15 * 60 * 1000);

        return session;
    }

    async processSignedPayload(
        sessionId: string,
        signature: string,
        w3id: string,
        message: string,
    ): Promise<{ success: boolean; migrationId?: string; error?: string }> {
        const session = this.sessions.get(sessionId);

        if (!session) {
            return { success: false, error: "Session not found or expired" };
        }

        if (session.expiresAt < new Date()) {
            this.sessions.delete(sessionId);
            return { success: false, error: "Session expired" };
        }

        // Verify signature (simplified - in production, use proper signature verification)
        // For now, we'll just check that signature exists
        if (!signature) {
            return { success: false, error: "Invalid signature" };
        }

        session.signed = true;
        this.emit(sessionId, {
            success: true,
            migrationId: session.migrationId,
        });

        return {
            success: true,
            migrationId: session.migrationId,
        };
    }

    getSession(sessionId: string): SigningSession | undefined {
        return this.sessions.get(sessionId);
    }
}

