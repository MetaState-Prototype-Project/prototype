import { decodeJwt } from "jose";

const WINDOW_MS = 60_000; // 1-minute window
const MAX_REQUESTS_PER_PLATFORM =
    Number(process.env.RATE_LIMIT_PER_PLATFORM) || 250;
const MAX_REQUESTS_PER_IP = Number(process.env.RATE_LIMIT_PER_IP) || 500;

interface RateRecord {
    count: number;
    windowStart: number;
}

const platformRecords = new Map<string, RateRecord>();
const ipRecords = new Map<string, RateRecord>();

function check(
    map: Map<string, RateRecord>,
    key: string,
    limit: number,
): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    let rec = map.get(key);

    if (!rec || now - rec.windowStart > WINDOW_MS) {
        rec = { count: 0, windowStart: now };
        map.set(key, rec);
    }

    rec.count++;

    if (rec.count > limit) {
        const retryAfterSeconds = Math.ceil(
            (rec.windowStart + WINDOW_MS - now) / 1000,
        );
        return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true, retryAfterSeconds: 0 };
}

function extractPlatform(token: string): string | null {
    try {
        const payload = decodeJwt(token);
        return (payload as any).platform ?? null;
    } catch {
        return null;
    }
}

export function checkGlobalRateLimit(
    token: string | null,
    ip: string,
): { allowed: boolean; retryAfterSeconds: number } {
    if (token) {
        const platform = extractPlatform(token);
        if (platform) {
            const result = check(
                platformRecords,
                platform,
                MAX_REQUESTS_PER_PLATFORM,
            );
            if (!result.allowed) return result;
        }
    }

    return check(ipRecords, ip, MAX_REQUESTS_PER_IP);
}

// Periodically clean up stale entries to prevent memory growth
setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of platformRecords) {
        if (now - rec.windowStart > WINDOW_MS) platformRecords.delete(key);
    }
    for (const [key, rec] of ipRecords) {
        if (now - rec.windowStart > WINDOW_MS) ipRecords.delete(key);
    }
}, 60_000);
