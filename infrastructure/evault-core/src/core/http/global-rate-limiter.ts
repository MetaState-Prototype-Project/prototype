import type { FastifyReply, FastifyRequest } from "fastify";
import type { RateLimitMode } from "../../entities/RateLimitRule";
import type { RateLimitSnapshot } from "../../services/RateLimitConfigService";
import { verifyPlatform } from "../auth/registry-token";
import { normalizeIp } from "./ip-rules";

const WINDOW_MS = 60_000; // 1-minute window
const USAGE_ROWS = 200;

interface RateRecord {
    count: number;
    rejected: number;
    windowStart: number;
}

export type RateLimitDecision =
    | { allowed: true }
    | { allowed: false; status: 403 }
    | {
          allowed: false;
          status: 429;
          scope: "ip" | "platform";
          retryAfterSeconds: number;
      };

export interface UsageRow {
    subject: string;
    /** Requests seen this window, rejected ones included. */
    count: number;
    rejected: number;
    limit: number;
    mode: RateLimitMode;
    /** The rule that set the limit, or null when the default applies. */
    matchedRule: string | null;
    resetsInSeconds: number;
}

export interface RateLimitUsage {
    generatedAt: Date;
    windowSeconds: number;
    platforms: UsageRow[];
    ips: UsageRow[];
    /** True when either list was cut to the busiest {@link USAGE_ROWS}. */
    truncated: boolean;
}

/**
 * Fixed-window request limiter for the public eVault API.
 *
 * Every request is held to its IP's limit first. A request carrying a valid
 * Registry token is then also held to its platform's limit. The Registry
 * signs any platform name, so a platform rule can only narrow what a caller
 * may do: nothing a token claims lifts the IP ceiling.
 *
 * Counters live in this process. Several instances each count separately.
 */
export class GlobalRateLimiter {
    private readonly platformRecords = new Map<string, RateRecord>();
    private readonly ipRecords = new Map<string, RateRecord>();
    private timer?: NodeJS.Timeout;

    constructor(
        private readonly getSnapshot: () => RateLimitSnapshot,
        private readonly platformOf: (
            token: string | null,
        ) => Promise<string | null> = verifyPlatform,
        private readonly now: () => number = Date.now,
    ) {}

    /** Starts the sweep that drops counters whose window has passed. */
    start(): void {
        this.timer = setInterval(() => this.sweep(), WINDOW_MS);
        this.timer.unref();
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
    }

    async check(
        method: string,
        rawIp: string,
        token: string | null,
    ): Promise<RateLimitDecision> {
        // A CORS preflight carries no credentials and does no work.
        if (method === "OPTIONS") return { allowed: true };

        const snapshot = this.getSnapshot();
        const ip = normalizeIp(rawIp);
        const ipRule = snapshot.matchIp(ip);
        if (ipRule?.mode === "blocked") return { allowed: false, status: 403 };
        if (ipRule?.mode === "exempt") return { allowed: true };

        // The IP is counted before the token is looked at, so an abusive
        // caller is turned away without the cost of verifying a signature.
        const ipLimit = ipRule?.limitPerMinute ?? snapshot.ipDefault.limit;
        const ipResult = this.count(this.ipRecords, ip, ipLimit);
        if (ipResult) return { ...ipResult, scope: "ip" };

        const platform = await this.platformOf(token);
        if (!platform) return { allowed: true };

        // Rules may have been reloaded while the token was being verified.
        const current = this.getSnapshot();
        const platformRule = current.platformRules.get(platform);
        if (platformRule?.mode === "blocked") {
            return { allowed: false, status: 403 };
        }
        if (platformRule?.mode === "exempt") return { allowed: true };

        const platformLimit =
            platformRule?.limitPerMinute ?? current.platformDefault.limit;
        const platformResult = this.count(
            this.platformRecords,
            platform,
            platformLimit,
        );
        if (platformResult) return { ...platformResult, scope: "platform" };
        return { allowed: true };
    }

    /** Live counters, busiest relative to their limit first. */
    getUsage(): RateLimitUsage {
        const snapshot = this.getSnapshot();
        const now = this.now();

        const rows = (
            records: Map<string, RateRecord>,
            resolve: (subject: string) => {
                limit: number;
                mode: RateLimitMode;
                matchedRule: string | null;
            },
        ): UsageRow[] => {
            const result: UsageRow[] = [];
            for (const [subject, rec] of records) {
                if (now - rec.windowStart > WINDOW_MS) continue;
                result.push({
                    subject,
                    count: rec.count,
                    rejected: rec.rejected,
                    ...resolve(subject),
                    resetsInSeconds: Math.ceil(
                        (rec.windowStart + WINDOW_MS - now) / 1000,
                    ),
                });
            }
            return result.sort(
                (a, b) => b.count / b.limit - a.count / a.limit,
            );
        };

        const platforms = rows(this.platformRecords, (platform) => {
            const rule = snapshot.platformRules.get(platform);
            return {
                limit: rule?.limitPerMinute ?? snapshot.platformDefault.limit,
                mode: rule?.mode ?? "limit",
                matchedRule: rule?.subject ?? null,
            };
        });
        const ips = rows(this.ipRecords, (ip) => {
            const rule = snapshot.matchIp(ip);
            return {
                limit: rule?.limitPerMinute ?? snapshot.ipDefault.limit,
                mode: rule?.mode ?? "limit",
                matchedRule: rule?.subject ?? null,
            };
        });

        return {
            generatedAt: new Date(now),
            windowSeconds: WINDOW_MS / 1000,
            platforms: platforms.slice(0, USAGE_ROWS),
            ips: ips.slice(0, USAGE_ROWS),
            truncated:
                platforms.length > USAGE_ROWS || ips.length > USAGE_ROWS,
        };
    }

    private count(
        map: Map<string, RateRecord>,
        key: string,
        limit: number,
    ): { allowed: false; status: 429; retryAfterSeconds: number } | null {
        const now = this.now();
        let rec = map.get(key);

        if (!rec || now - rec.windowStart > WINDOW_MS) {
            rec = { count: 0, rejected: 0, windowStart: now };
            map.set(key, rec);
        }

        rec.count++;

        if (rec.count > limit) {
            rec.rejected++;
            return {
                allowed: false,
                status: 429,
                retryAfterSeconds: Math.ceil(
                    (rec.windowStart + WINDOW_MS - now) / 1000,
                ),
            };
        }

        return null;
    }

    // Drops stale entries to prevent memory growth
    private sweep(): void {
        const now = this.now();
        for (const map of [this.platformRecords, this.ipRecords]) {
            for (const [key, rec] of map) {
                if (now - rec.windowStart > WINDOW_MS) map.delete(key);
            }
        }
    }
}

/** The Fastify `onRequest` hook that enforces a limiter. */
export function createRateLimitHook(limiter: GlobalRateLimiter) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const authHeader = request.headers.authorization;
        const token = authHeader?.startsWith("Bearer ")
            ? authHeader.substring(7)
            : null;
        const decision = await limiter.check(
            request.method,
            request.ip,
            token,
        );
        if (decision.allowed) return;

        // In an async onRequest hook, Fastify only short-circuits the
        // handler chain if you return the reply object. Without the
        // return, the response is queued but the downstream handler
        // (GraphQL) still runs — turning the rate limiter into a silent
        // counter.
        if (decision.status === 403) {
            return reply.code(403).send({ error: "Forbidden" });
        }
        return reply
            .code(429)
            .header("Retry-After", String(decision.retryAfterSeconds))
            .send({
                error: "Too Many Requests",
                retryAfterSeconds: decision.retryAfterSeconds,
                scope: decision.scope,
            });
    };
}

/**
 * Reads `EVAULT_TRUST_PROXY` into Fastify's `trustProxy` option: unset or
 * `false` trusts nothing, `true` trusts every hop, a number trusts that many
 * hops, and anything else is a comma-separated list of proxy addresses.
 *
 * Only an address list checks who is speaking. `true` and a hop count
 * believe X-Forwarded-For from any peer, so a client that can reach this
 * port without going through the proxy picks the IP it is limited as.
 */
export function parseTrustProxy(
    value: string | undefined,
): boolean | number | string {
    const trimmed = value?.trim() ?? "";
    if (trimmed === "" || trimmed.toLowerCase() === "false") return false;
    if (trimmed.toLowerCase() === "true") return true;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    return trimmed;
}
