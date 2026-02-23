/**
 * In-process IP rate limiter for the passphrase compare endpoint.
 *
 * Limits:
 *  - 5 attempts per IP per rolling 15-minute window.
 *  - On consecutive failures the next attempt is blocked for
 *    BASE_BACKOFF_MS * 2^(consecutiveFailures - 1), capped at MAX_BACKOFF_MS.
 *
 * This is an in-memory implementation suitable for single-instance deployments.
 * For multi-instance deployments, replace the Map with a Redis-backed store.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS_PER_WINDOW = 5;
const BASE_BACKOFF_MS = 2_000; // 2 seconds for first failure
const MAX_BACKOFF_MS = 30 * 60 * 1000; // 30 minutes maximum backoff

interface IpRecord {
    /** Number of attempts in the current window */
    attempts: number;
    /** Timestamp when the current window started */
    windowStart: number;
    /** Number of consecutive failures (resets on success) */
    consecutiveFailures: number;
    /** Timestamp after which the next attempt is allowed (0 = no backoff) */
    backoffUntil: number;
}

const records = new Map<string, IpRecord>();

function getOrCreate(ip: string): IpRecord {
    const now = Date.now();
    let rec = records.get(ip);

    if (!rec || now - rec.windowStart > WINDOW_MS) {
        rec = {
            attempts: 0,
            windowStart: now,
            consecutiveFailures: rec?.consecutiveFailures ?? 0,
            backoffUntil: rec?.backoffUntil ?? 0,
        };
        records.set(ip, rec);
    }

    return rec;
}

export interface RateLimitResult {
    allowed: boolean;
    /** Seconds until the next attempt is permitted (0 when allowed) */
    retryAfterSeconds: number;
    reason?: "rate_limit" | "backoff";
}

/**
 * Call this before processing a compare request.
 * Returns { allowed: false } if the IP is rate-limited or in backoff.
 */
export function checkRateLimit(ip: string): RateLimitResult {
    const now = Date.now();
    const rec = getOrCreate(ip);

    // Enforce exponential backoff from prior failures
    if (rec.backoffUntil > now) {
        const retryAfterSeconds = Math.ceil((rec.backoffUntil - now) / 1000);
        return { allowed: false, retryAfterSeconds, reason: "backoff" };
    }

    // Enforce per-window attempt cap
    if (rec.attempts >= MAX_ATTEMPTS_PER_WINDOW) {
        const windowEnd = rec.windowStart + WINDOW_MS;
        const retryAfterSeconds = Math.ceil((windowEnd - now) / 1000);
        return { allowed: false, retryAfterSeconds, reason: "rate_limit" };
    }

    return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Record the outcome of a compare attempt.
 * @param success - true if the passphrase matched, false otherwise.
 */
export function recordAttempt(ip: string, success: boolean): void {
    const rec = getOrCreate(ip);
    rec.attempts += 1;

    if (success) {
        rec.consecutiveFailures = 0;
        rec.backoffUntil = 0;
    } else {
        rec.consecutiveFailures += 1;
        const backoffMs = Math.min(
            BASE_BACKOFF_MS * 2 ** (rec.consecutiveFailures - 1),
            MAX_BACKOFF_MS,
        );
        rec.backoffUntil = Date.now() + backoffMs;
    }

    records.set(ip, rec);
}

// Periodically clean up stale entries to prevent memory growth
setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of records.entries()) {
        if (
            now - rec.windowStart > WINDOW_MS &&
            rec.backoffUntil < now &&
            rec.consecutiveFailures === 0
        ) {
            records.delete(ip);
        }
    }
}, 60_000);
