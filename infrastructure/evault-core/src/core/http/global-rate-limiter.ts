import { createHash } from "node:crypto";
import axios from "axios";
import * as jose from "jose";

const WINDOW_MS = 60_000;
const JWKS_TTL_MS = 24 * 60 * 60 * 1000;
const JWKS_FETCH_TIMEOUT_MS = 5_000;
const TOKEN_IDENTITY_CACHE_MAX_ENTRIES = 1_024;
const ENAME_PATTERN = /^@[^\s@]+$/;

// Preserve the existing conservative defaults for writes and anonymous IPs.
const DEFAULT_WRITE_REQUESTS_PER_PLATFORM = 250;
const DEFAULT_REQUESTS_PER_IP = 500;
// Authenticated reads are isolated per eVault tenant but still bounded by
// aggregate platform and platform/IP protection.
const DEFAULT_READ_REQUESTS_PER_TENANT = 250;
const DEFAULT_READ_REQUESTS_PER_PLATFORM = 2_000;
const DEFAULT_READ_REQUESTS_PER_PLATFORM_IP = 2_000;

interface RateRecord {
    count: number;
    windowStart: number;
}

export type GlobalRateLimitIntent = "read" | "write";

export interface GlobalRateLimitInput {
    /** Raw bearer token without the `Bearer ` prefix. */
    token: string | null;
    ip: string;
    /** X-ENAME; accepted only when it is a syntactically valid eName. */
    eName?: string | null;
    intent: GlobalRateLimitIntent;
}

export interface GlobalRateLimitResult {
    allowed: boolean;
    retryAfterSeconds: number;
}

export type AuthenticatedPlatformResolver = (
    token: string,
) => Promise<string | null>;

export interface GlobalRateLimiterOptions {
    authenticatePlatform?: AuthenticatedPlatformResolver;
    now?: () => number;
    writeRequestsPerPlatform?: number;
    requestsPerIp?: number;
    readRequestsPerTenant?: number;
    readRequestsPerPlatform?: number;
    readRequestsPerPlatformIp?: number;
}

type CachedJwks = {
    jwks: ReturnType<typeof jose.createLocalJWKSet>;
    expiresAt: number;
};

type CachedTokenIdentity = {
    platform: string;
    expiresAt: number;
};

const registryJwksCache = new Map<string, CachedJwks>();
const pendingRegistryJwks = new Map<
    string,
    Promise<ReturnType<typeof jose.createLocalJWKSet>>
>();
// Never use raw bearer tokens as Map keys: a digest is sufficient to coalesce
// validation while keeping credentials out of process-visible data structures.
const verifiedTokenIdentities = new Map<string, CachedTokenIdentity>();

function positiveInteger(value: unknown, fallback: number): number {
    const parsed = typeof value === "string" ? Number(value) : value;
    return typeof parsed === "number" &&
        Number.isSafeInteger(parsed) &&
        parsed > 0
        ? parsed
        : fallback;
}

function configuredLimits() {
    return {
        // Existing variables retain their original write/anonymous meaning.
        writeRequestsPerPlatform: positiveInteger(
            process.env.RATE_LIMIT_PER_PLATFORM,
            DEFAULT_WRITE_REQUESTS_PER_PLATFORM,
        ),
        requestsPerIp: positiveInteger(
            process.env.RATE_LIMIT_PER_IP,
            DEFAULT_REQUESTS_PER_IP,
        ),
        readRequestsPerTenant: positiveInteger(
            process.env.RATE_LIMIT_READS_PER_TENANT,
            DEFAULT_READ_REQUESTS_PER_TENANT,
        ),
        readRequestsPerPlatform: positiveInteger(
            process.env.RATE_LIMIT_READS_PER_PLATFORM,
            DEFAULT_READ_REQUESTS_PER_PLATFORM,
        ),
        readRequestsPerPlatformIp: positiveInteger(
            process.env.RATE_LIMIT_READS_PER_PLATFORM_IP,
            DEFAULT_READ_REQUESTS_PER_PLATFORM_IP,
        ),
    };
}

function normalizePlatform(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    return normalized &&
        normalized.length <= 4_096 &&
        !normalized.includes("\u0000")
        ? normalized
        : null;
}

function normalizeEName(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim().toLowerCase();
    return normalized.length <= 4_096 && ENAME_PATTERN.test(normalized)
        ? normalized
        : null;
}

function normalizeIp(value: string): string {
    const normalized = value.trim().toLowerCase();
    return normalized &&
        normalized.length <= 4_096 &&
        !normalized.includes("\u0000")
        ? normalized
        : "unknown";
}

function bucketKey(...parts: string[]): string {
    return parts.join("\u0000");
}

function check(
    records: Map<string, RateRecord>,
    key: string,
    limit: number,
    now: number,
): GlobalRateLimitResult {
    let record = records.get(key);
    if (!record || now - record.windowStart > WINDOW_MS) {
        record = { count: 0, windowStart: now };
        records.set(key, record);
    }
    record.count += 1;
    if (record.count > limit) {
        return {
            allowed: false,
            retryAfterSeconds: Math.ceil(
                (record.windowStart + WINDOW_MS - now) / 1000,
            ),
        };
    }
    return { allowed: true, retryAfterSeconds: 0 };
}

async function resolveRegistryJwks(
    jwksUrl: string,
): Promise<ReturnType<typeof jose.createLocalJWKSet>> {
    const cached = registryJwksCache.get(jwksUrl);
    if (cached && cached.expiresAt > Date.now()) return cached.jwks;
    const pending = pendingRegistryJwks.get(jwksUrl);
    if (pending) return pending;
    const request = axios
        .get(jwksUrl, { timeout: JWKS_FETCH_TIMEOUT_MS })
        .then((response) => {
            const jwks = jose.createLocalJWKSet(response.data);
            registryJwksCache.set(jwksUrl, {
                jwks,
                expiresAt: Date.now() + JWKS_TTL_MS,
            });
            return jwks;
        })
        .finally(() => pendingRegistryJwks.delete(jwksUrl));
    pendingRegistryJwks.set(jwksUrl, request);
    return request;
}

function tokenDigest(token: string): string {
    return createHash("sha256").update(token).digest("base64url");
}

function cacheVerifiedTokenIdentity(
    digest: string,
    platform: string,
    tokenExpiresAt: number,
): void {
    const now = Date.now();
    const expiresAt = Math.min(now + JWKS_TTL_MS, tokenExpiresAt);
    if (expiresAt <= now) return;
    for (const [key, cached] of verifiedTokenIdentities) {
        if (cached.expiresAt <= now) verifiedTokenIdentities.delete(key);
    }
    while (verifiedTokenIdentities.size >= TOKEN_IDENTITY_CACHE_MAX_ENTRIES) {
        const oldestDigest = verifiedTokenIdentities.keys().next().value;
        if (!oldestDigest) break;
        verifiedTokenIdentities.delete(oldestDigest);
    }
    verifiedTokenIdentities.set(digest, { platform, expiresAt });
}

/**
 * Uses a Registry-verified platform claim. Decoding an unverified JWT would
 * let a forged `platform` claim choose an arbitrary read bucket.
 */
export async function authenticatedPlatformFromToken(
    token: string,
): Promise<string | null> {
    const digest = tokenDigest(token);
    const cached = verifiedTokenIdentities.get(digest);
    if (cached && cached.expiresAt > Date.now()) return cached.platform;
    if (cached) verifiedTokenIdentities.delete(digest);

    const registryUrl =
        process.env.PUBLIC_REGISTRY_URL || process.env.REGISTRY_URL;
    if (!registryUrl) return null;
    try {
        const jwks = await resolveRegistryJwks(
            new URL("/.well-known/jwks.json", registryUrl).toString(),
        );
        const { payload } = await jose.jwtVerify(token, jwks);
        const platform = normalizePlatform(payload.platform);
        // Do not cache a token without an expiry: the cache must never outlive
        // the token's own authorization lifetime.
        if (
            platform &&
            typeof payload.exp === "number" &&
            Number.isFinite(payload.exp)
        ) {
            cacheVerifiedTokenIdentity(digest, platform, payload.exp * 1_000);
        }
        return platform;
    } catch {
        return null;
    }
}

/**
 * Authenticated reads are bounded per `(platform, X-ENAME)` and also by
 * aggregate platform and platform/IP caps. Writes deliberately keep the old
 * platform + generic IP quotas and never receive an eName-derived exemption.
 */
export function createGlobalRateLimiter(
    options: GlobalRateLimiterOptions = {},
) {
    const defaults = configuredLimits();
    const limits = {
        writeRequestsPerPlatform: positiveInteger(
            options.writeRequestsPerPlatform,
            defaults.writeRequestsPerPlatform,
        ),
        requestsPerIp: positiveInteger(
            options.requestsPerIp,
            defaults.requestsPerIp,
        ),
        readRequestsPerTenant: positiveInteger(
            options.readRequestsPerTenant,
            defaults.readRequestsPerTenant,
        ),
        readRequestsPerPlatform: positiveInteger(
            options.readRequestsPerPlatform,
            defaults.readRequestsPerPlatform,
        ),
        readRequestsPerPlatformIp: positiveInteger(
            options.readRequestsPerPlatformIp,
            defaults.readRequestsPerPlatformIp,
        ),
    };
    const now = options.now ?? Date.now;
    const authenticatePlatform =
        options.authenticatePlatform ?? authenticatedPlatformFromToken;
    const tenantReadRecords = new Map<string, RateRecord>();
    const platformReadRecords = new Map<string, RateRecord>();
    const platformIpReadRecords = new Map<string, RateRecord>();
    const platformWriteRecords = new Map<string, RateRecord>();
    const ipRecords = new Map<string, RateRecord>();

    const prune = (at = now()) => {
        for (const records of [
            tenantReadRecords,
            platformReadRecords,
            platformIpReadRecords,
            platformWriteRecords,
            ipRecords,
        ]) {
            for (const [key, record] of records) {
                if (at - record.windowStart > WINDOW_MS) records.delete(key);
            }
        }
    };

    const checkRequest = async (
        input: GlobalRateLimitInput,
    ): Promise<GlobalRateLimitResult> => {
        const requestTime = now();
        const ip = normalizeIp(input.ip);
        let platform: string | null = null;
        if (input.token) {
            try {
                platform = await authenticatePlatform(input.token);
            } catch {
                platform = null;
            }
        }

        if (input.intent === "read" && platform) {
            const tenant = normalizeEName(input.eName);
            // An absent or malformed X-ENAME must remain on the strict path;
            // it cannot receive the tenant-read capacity by guessing a key.
            if (!tenant) {
                const platformResult = check(
                    platformWriteRecords,
                    platform,
                    limits.writeRequestsPerPlatform,
                    requestTime,
                );
                if (!platformResult.allowed) return platformResult;
                return check(ipRecords, ip, limits.requestsPerIp, requestTime);
            }

            const tenantResult = check(
                tenantReadRecords,
                bucketKey(platform, tenant),
                limits.readRequestsPerTenant,
                requestTime,
            );
            if (!tenantResult.allowed) return tenantResult;
            const platformResult = check(
                platformReadRecords,
                platform,
                limits.readRequestsPerPlatform,
                requestTime,
            );
            if (!platformResult.allowed) return platformResult;
            return check(
                platformIpReadRecords,
                bucketKey(platform, ip),
                limits.readRequestsPerPlatformIp,
                requestTime,
            );
        }

        if (platform) {
            const platformResult = check(
                platformWriteRecords,
                platform,
                limits.writeRequestsPerPlatform,
                requestTime,
            );
            if (!platformResult.allowed) return platformResult;
        }
        return check(ipRecords, ip, limits.requestsPerIp, requestTime);
    };

    return { check: checkRequest, prune };
}

const globalRateLimiter = createGlobalRateLimiter();

export async function checkGlobalRateLimit(
    input: GlobalRateLimitInput,
): Promise<GlobalRateLimitResult> {
    return globalRateLimiter.check(input);
}

const cleanupTimer = setInterval(() => globalRateLimiter.prune(), WINDOW_MS);
cleanupTimer.unref?.();
