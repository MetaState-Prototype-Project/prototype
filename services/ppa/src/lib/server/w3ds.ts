import { randomUUID } from "node:crypto";
// Import the TS source rather than the package main: the published dist is
// CommonJS, which rollup cannot statically analyse for named exports when
// bundling the SSR build. Same workaround as platforms/enotary.
import { verifySignature } from "signature-validator/src/index";
import { publicUrl, registryUrl } from "./env";

/**
 * w3ds://auth login. The eID wallet signs a session id we generated; we verify
 * that signature against the registry and hand the session back as
 * authenticated. Pending sessions are held in memory with a short TTL, so a
 * restart simply invalidates any login mid-flight.
 *
 * Mirrors services/awareness-service/api/src/services/W3dsAuthService.ts.
 */

interface PendingSession {
    createdAt: number;
    ename?: string;
    status: "pending" | "authenticated";
}

const SESSION_TTL_MS = 10 * 60 * 1000;

/**
 * Kept on globalThis rather than in module scope on purpose. The offer, the
 * wallet's callback and the browser's poll are three separate requests, and
 * Vite's dev SSR can hand different request entry points their own instance of
 * this module — which silently splits the map, so a login verifies but the
 * page polling for it never sees the result. Anchoring the store outside the
 * module graph makes the three requests share one map, and also keeps logins
 * mid-flight alive across an HMR reload.
 */
const STORE = Symbol.for("ppa.w3ds.sessions");
const globalStore = globalThis as typeof globalThis & {
    [STORE]?: Map<string, PendingSession>;
};
const sessions: Map<string, PendingSession> = (globalStore[STORE] ??= new Map());

function gc(): void {
    const now = Date.now();
    for (const [id, s] of sessions) {
        if (now - s.createdAt > SESSION_TTL_MS) sessions.delete(id);
    }
}

/** Builds the w3ds://auth offer the login page renders as a QR code. */
export function createOffer(): { uri: string; session: string } {
    gc();
    const session = randomUUID();
    sessions.set(session, { createdAt: Date.now(), status: "pending" });
    const redirect = new URL("/api/auth", publicUrl()).toString();
    const uri = `w3ds://auth?redirect=${redirect}&session=${session}&platform=ppa`;
    return { uri, session };
}

/** Wallet callback: verify the signature over the session id. */
export async function completeLogin(
    ename: string,
    session: string,
    signature: string,
): Promise<{ ok: boolean; error?: string }> {
    const pending = sessions.get(session);
    if (!pending) return { ok: false, error: "unknown or expired session" };

    const result = await verifySignature({
        eName: ename,
        signature,
        payload: session,
        registryBaseUrl: registryUrl(),
    });
    if (!result.valid) {
        return { ok: false, error: result.error ?? "invalid signature" };
    }

    pending.ename = ename;
    pending.status = "authenticated";
    console.info("[ppa/auth] session authenticated for", ename);
    return { ok: true };
}

/**
 * Polled by the login page. Returns the authenticated eName exactly once —
 * the caller is responsible for the allowlist check and cookie minting.
 *
 * "unknown" is reported separately from "pending" so a QR that has expired (or
 * was issued by a previous process) tells the page to start over instead of
 * polling forever, and so a store that is not shared across requests shows up
 * immediately rather than looking like a login that never completes.
 */
export function pollSession(
    session: string,
):
    | { status: "pending" }
    | { status: "unknown" }
    | { status: "authenticated"; ename: string } {
    const pending = sessions.get(session);
    if (!pending) return { status: "unknown" };
    if (pending.status === "authenticated" && pending.ename) {
        sessions.delete(session);
        return { status: "authenticated", ename: pending.ename };
    }
    return { status: "pending" };
}
