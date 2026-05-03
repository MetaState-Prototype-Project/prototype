/**
 * Exponential backoff schedule (in milliseconds) for failed webhook deliveries.
 * Index = attempt number that just failed (1-based). Beyond the table the last
 * value is reused.
 */
const SCHEDULE_MS = [
    30_000, // after attempt 1: 30s
    60_000, // after attempt 2: 1m
    120_000, // after attempt 3: 2m
    300_000, // after attempt 4: 5m
    900_000, // after attempt 5: 15m
    3_600_000, // after attempt 6: 1h
    21_600_000, // after attempt 7: 6h
    86_400_000, // after attempt 8: 24h
];

/** Returns the Date at which a delivery should next be attempted. */
export function nextAttemptAt(attempts: number, from: Date = new Date()): Date {
    const idx = Math.min(Math.max(attempts, 1), SCHEDULE_MS.length) - 1;
    const base = SCHEDULE_MS[idx];
    // +/-10% jitter to avoid thundering-herd retries.
    const jitter = base * (Math.random() * 0.2 - 0.1);
    return new Date(from.getTime() + base + jitter);
}
