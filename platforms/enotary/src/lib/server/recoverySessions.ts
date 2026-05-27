/**
 * In-memory recovery-session store. Single-process scope; a restart wipes
 * pending sessions, which is acceptable for the 15-minute TTL we use.
 *
 * Each session is one-shot: created on /api/recovery/issue, consumed exactly
 * once on /api/recovery/claim. The JWT-signed QR carries the sessionId; the
 * eVault auth chain lives wallet-side via the notary's JWKS.
 */

export interface RecoverySession {
    sessionId: string;
    targetEName: string;
    notaryEName: string;
    issuedAt: number;
    expiresAt: number;
    status: "pending" | "consumed";
    consumedAt: number | null;
    vaultUri: string;
}

export const RECOVERY_TTL_MS = 15 * 60 * 1000;

const sessions = new Map<string, RecoverySession>();

// Sweep expired sessions every minute so the map doesn't grow unbounded
// across days of uptime.
const SWEEP_INTERVAL_MS = 60 * 1000;
let sweeper: ReturnType<typeof setInterval> | null = null;

function startSweeper(): void {
    if (sweeper) return;
    sweeper = setInterval(() => {
        const now = Date.now();
        for (const [id, session] of sessions) {
            if (session.expiresAt < now && session.status === "pending") {
                sessions.delete(id);
            }
        }
    }, SWEEP_INTERVAL_MS);
    // Don't keep the process alive just for the sweeper.
    sweeper.unref?.();
}

export function createSession(args: {
    targetEName: string;
    notaryEName: string;
    vaultUri: string;
}): RecoverySession {
    startSweeper();
    const now = Date.now();
    const session: RecoverySession = {
        sessionId: crypto.randomUUID(),
        targetEName: args.targetEName,
        notaryEName: args.notaryEName,
        issuedAt: now,
        expiresAt: now + RECOVERY_TTL_MS,
        status: "pending",
        consumedAt: null,
        vaultUri: args.vaultUri,
    };
    sessions.set(session.sessionId, session);
    return session;
}

export function getSession(sessionId: string): RecoverySession | undefined {
    return sessions.get(sessionId);
}

export type ConsumeFailure =
    | "not_found"
    | "expired"
    | "consumed"
    | "mismatch";

export type ConsumeResult =
    | { ok: true; session: RecoverySession }
    | { ok: false; reason: ConsumeFailure };

/**
 * Attempt to consume a session. Validates expiry + status + that the caller
 * is asking for the same eName the notary issued for. On success, marks
 * `consumed` and returns the session snapshot.
 */
export function consumeSession(args: {
    sessionId: string;
    targetEName: string;
}): ConsumeResult {
    const session = sessions.get(args.sessionId);
    if (!session) return { ok: false, reason: "not_found" };
    if (session.targetEName !== args.targetEName) {
        return { ok: false, reason: "mismatch" };
    }
    if (session.status === "consumed") {
        return { ok: false, reason: "consumed" };
    }
    if (session.expiresAt < Date.now()) {
        return { ok: false, reason: "expired" };
    }
    session.status = "consumed";
    session.consumedAt = Date.now();
    sessions.set(args.sessionId, session);
    return { ok: true, session };
}
