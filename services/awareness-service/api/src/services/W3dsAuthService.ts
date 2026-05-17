import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { verifySignature } from "signature-validator";
import { config } from "../config";

interface PendingSession {
    createdAt: number;
    ename?: string;
    status: "pending" | "authenticated";
}

const SESSION_TTL_MS = 10 * 60 * 1000;

/**
 * Handles W3DS login for the portal. A session id is signed by the user's eID
 * wallet; the signature is verified against the registry and exchanged for a
 * portal session JWT. Pending sessions are held in memory with a short TTL.
 */
export class W3dsAuthService {
    private sessions = new Map<string, PendingSession>();

    /** Builds a w3ds://auth offer the portal renders as a QR / deeplink. */
    createOffer(): { uri: string; session: string } {
        this.gc();
        const session = randomUUID();
        this.sessions.set(session, {
            createdAt: Date.now(),
            status: "pending",
        });
        const redirect = new URL("/api/auth", config.publicUrl).toString();
        const uri = `w3ds://auth?redirect=${redirect}&session=${session}&platform=awareness-service`;
        return { uri, session };
    }

    /** Callback target: verifies the wallet signature over the session id. */
    async completeLogin(
        ename: string,
        session: string,
        signature: string,
    ): Promise<{ ok: boolean; error?: string }> {
        const pending = this.sessions.get(session);
        if (!pending) return { ok: false, error: "unknown or expired session" };

        const result = await verifySignature({
            eName: ename,
            signature,
            payload: session,
            registryBaseUrl: config.registryUrl,
        });
        if (!result.valid) {
            return { ok: false, error: result.error ?? "invalid signature" };
        }

        pending.ename = ename;
        pending.status = "authenticated";
        return { ok: true };
    }

    /**
     * Polled by the portal. Once authenticated, returns a session JWT and
     * consumes the pending session.
     */
    pollSession(
        session: string,
    ): { status: "pending" } | { status: "authenticated"; token: string } {
        const pending = this.sessions.get(session);
        if (!pending) {
            return { status: "pending" };
        }
        if (pending.status === "authenticated" && pending.ename) {
            this.sessions.delete(session);
            return {
                status: "authenticated",
                token: this.issueToken(pending.ename),
            };
        }
        return { status: "pending" };
    }

    issueToken(ename: string): string {
        // isAdmin is embedded so the portal can show/hide admin UI without an
        // extra round-trip; the API still re-checks it server-side.
        return jwt.sign(
            { ename, isAdmin: config.adminEnames.includes(ename) },
            config.jwtSecret,
            { expiresIn: "7d" },
        );
    }

    verifyToken(token: string): { ename: string } | null {
        try {
            const decoded = jwt.verify(token, config.jwtSecret) as {
                ename?: string;
            };
            return decoded.ename ? { ename: decoded.ename } : null;
        } catch {
            return null;
        }
    }

    private gc(): void {
        const now = Date.now();
        for (const [id, s] of this.sessions) {
            if (now - s.createdAt > SESSION_TTL_MS) this.sessions.delete(id);
        }
    }
}

/** Shared singleton so the auth offer and callback share session state. */
export const w3dsAuthService = new W3dsAuthService();
