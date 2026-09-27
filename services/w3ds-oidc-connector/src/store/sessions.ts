/**
 * Login sessions: one per /authorize, identified by the random value S the
 * wallet signs. All transitions are synchronous, so each is atomic in Node.
 *
 *   pending --approve--> approved --claim--> delivered
 *
 * `claim` is the single point where a session is consumed, and it only
 * succeeds for the browser that started the login.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthorizationRequest, Identity } from "../types.js";

export type SessionStatus = "pending" | "approved" | "delivered";

export interface Session extends AuthorizationRequest {
    id: string;
    status: SessionStatus;
    createdAt: number;
    expiresAt: number;
    identity?: Identity;
    /** Open SSE streams for this session. */
    streams: number;
    browserHash: Buffer;
}

export type SessionLookup =
    | { state: "unknown" }
    | { state: "expired" }
    | { state: "live"; session: Session };

const APPROVED_GRACE_MS = 120_000;

function hashBrowserSecret(secret: string): Buffer {
    return createHash("sha256").update(secret, "utf8").digest();
}

export class SessionStore {
    private readonly sessions = new Map<string, Session>();

    constructor(private readonly ttlMs: number) {}

    /**
     * Opens a session bound to `browserSecret`, the value only the browser
     * that started the login holds (in a cookie).
     */
    create(
        request: AuthorizationRequest,
        browserSecret: string,
        now: number,
    ): Session {
        const session: Session = {
            ...request,
            id: randomBytes(32).toString("base64url"),
            status: "pending",
            createdAt: now,
            expiresAt: now + this.ttlMs,
            streams: 0,
            browserHash: hashBrowserSecret(browserSecret),
        };
        this.sessions.set(session.id, session);
        return session;
    }

    lookup(id: string, now: number): SessionLookup {
        const session = this.sessions.get(id);
        if (!session) return { state: "unknown" };
        if (now >= session.expiresAt) return { state: "expired" };
        return { state: "live", session };
    }

    /** True if `browserSecret` is the one this session was opened with. */
    isBrowser(session: Session, browserSecret: string | undefined): boolean {
        if (!browserSecret) return false;
        return timingSafeEqual(
            hashBrowserSecret(browserSecret),
            session.browserHash,
        );
    }

    /**
     * Records the wallet's verified identity. Only a live pending session can
     * be approved, and only once. Extends the session so a backgrounded tab
     * can still collect the result.
     */
    approve(id: string, identity: Identity, now: number): boolean {
        const lookup = this.lookup(id, now);
        if (lookup.state !== "live" || lookup.session.status !== "pending") {
            return false;
        }
        const { session } = lookup;
        session.status = "approved";
        session.identity = identity;
        session.expiresAt = Math.max(
            session.expiresAt,
            now + APPROVED_GRACE_MS,
        );
        return true;
    }

    /**
     * Consumes an approved session for the browser that started it. Returns
     * the session exactly once; every later call returns undefined.
     */
    claim(
        id: string,
        browserSecret: string | undefined,
        now: number,
    ): Session | undefined {
        const lookup = this.lookup(id, now);
        if (lookup.state !== "live") return undefined;
        const { session } = lookup;
        if (session.status !== "approved") return undefined;
        if (!this.isBrowser(session, browserSecret)) return undefined;
        session.status = "delivered";
        return session;
    }

    sweep(now: number): void {
        for (const [id, session] of this.sessions) {
            if (now >= session.expiresAt) this.sessions.delete(id);
        }
    }

    get size(): number {
        return this.sessions.size;
    }
}
