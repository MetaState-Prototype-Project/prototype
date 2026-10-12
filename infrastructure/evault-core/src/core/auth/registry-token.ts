import { createHash } from "node:crypto";
import axios from "axios";
import * as jose from "jose";
import { timed } from "../utils/timing";

type JwksResolver = ReturnType<typeof jose.createLocalJWKSet>;

type CachedJwks = {
    jwks: JwksResolver;
    fetchedAt: number;
    expiresAt: number;
};

const JWKS_TTL_MS = 24 * 60 * 60 * 1000;
const JWKS_FETCH_TIMEOUT_MS = 5000;
// After a failed fetch, wait this long before asking the Registry again so an
// outage costs one timeout rather than one per request.
const JWKS_FAILURE_BACKOFF_MS = 30_000;
// An unknown `kid` may mean the Registry rotated its key; refetch at most
// this often.
const JWKS_ROTATION_REFETCH_MS = 60_000;

const PLATFORM_CACHE_MAX = 5000;
const PLATFORM_CACHE_TTL_MS = 10 * 60 * 1000;
const PLATFORM_NEGATIVE_TTL_MS = 60_000;
const PLATFORM_MAX_LENGTH = 256;

const jwksCache = new Map<string, CachedJwks>();
const jwksInFlight = new Map<string, Promise<CachedJwks>>();
const jwksRetryAt = new Map<string, number>();
const platformCache = new Map<
    string,
    { platform: string | null; expiresAt: number }
>();

function registryJwksUrl(): string {
    const registryUrl =
        process.env.PUBLIC_REGISTRY_URL || process.env.REGISTRY_URL;
    if (!registryUrl) {
        throw new Error("PUBLIC_REGISTRY_URL or REGISTRY_URL is not set");
    }
    return new URL("/.well-known/jwks.json", registryUrl).toString();
}

function fetchJwks(jwksUrl: string): Promise<CachedJwks> {
    let pending = jwksInFlight.get(jwksUrl);
    if (!pending) {
        pending = timed("registryToken.fetchJWKS", () =>
            axios.get(jwksUrl, { timeout: JWKS_FETCH_TIMEOUT_MS }),
        )
            .then((response) => {
                const now = Date.now();
                const cached = {
                    jwks: jose.createLocalJWKSet(response.data),
                    fetchedAt: now,
                    expiresAt: now + JWKS_TTL_MS,
                };
                jwksCache.set(jwksUrl, cached);
                jwksRetryAt.delete(jwksUrl);
                return cached;
            })
            .catch((error) => {
                jwksRetryAt.set(jwksUrl, Date.now() + JWKS_FAILURE_BACKOFF_MS);
                throw error;
            })
            .finally(() => {
                jwksInFlight.delete(jwksUrl);
            });
        jwksInFlight.set(jwksUrl, pending);
    }
    return pending;
}

/**
 * The Registry's signing keys, cached for a day. A stale set keeps being
 * served while the Registry is unreachable.
 */
async function getRegistryJwks(jwksUrl: string): Promise<CachedJwks> {
    const now = Date.now();
    const cached = jwksCache.get(jwksUrl);
    if (cached && cached.expiresAt > now) return cached;

    if ((jwksRetryAt.get(jwksUrl) ?? 0) > now) {
        if (cached) return cached;
        throw new Error("Registry JWKS is unavailable");
    }

    try {
        return await fetchJwks(jwksUrl);
    } catch (error) {
        if (cached) return cached;
        throw error;
    }
}

/**
 * Verifies a Registry-issued token and returns its payload. Throws when the
 * token is invalid or the Registry's keys cannot be obtained.
 */
export async function verifyRegistryToken(
    token: string,
    options?: jose.JWTVerifyOptions,
): Promise<jose.JWTPayload> {
    const jwksUrl = registryJwksUrl();
    const cached = await getRegistryJwks(jwksUrl);
    try {
        const { payload } = await jose.jwtVerify(token, cached.jwks, options);
        return payload;
    } catch (error) {
        const rotated =
            error instanceof jose.errors.JWKSNoMatchingKey &&
            Date.now() - cached.fetchedAt > JWKS_ROTATION_REFETCH_MS &&
            (jwksRetryAt.get(jwksUrl) ?? 0) <= Date.now();
        if (!rotated) throw error;
        const refreshed = await fetchJwks(jwksUrl);
        const { payload } = await jose.jwtVerify(
            token,
            refreshed.jwks,
            options,
        );
        return payload;
    }
}

function rememberPlatform(
    key: string,
    platform: string | null,
    expiresAt: number,
): void {
    if (platformCache.size >= PLATFORM_CACHE_MAX) {
        const oldest = platformCache.keys().next().value;
        if (oldest !== undefined) platformCache.delete(oldest);
    }
    platformCache.set(key, { platform, expiresAt });
}

/**
 * The calling platform a token proves, or null when the token is missing,
 * invalid or carries no platform. Results are cached by token hash so the
 * signature is checked once per token rather than once per request.
 *
 * The Registry signs any platform name it is asked for, so this proves the
 * token is genuine, not who the caller is.
 */
export async function verifyPlatform(
    token: string | null | undefined,
): Promise<string | null> {
    if (!token) return null;

    const key = createHash("sha256").update(token).digest("base64");
    const now = Date.now();
    const hit = platformCache.get(key);
    if (hit && hit.expiresAt > now) return hit.platform;
    platformCache.delete(key);

    try {
        const payload = await verifyRegistryToken(token, {
            algorithms: ["ES256"],
        });
        const claim = payload.platform;
        const platform =
            typeof claim === "string" &&
            claim.trim().length > 0 &&
            claim.trim().length <= PLATFORM_MAX_LENGTH
                ? claim.trim()
                : null;
        const tokenExpiry =
            typeof payload.exp === "number"
                ? payload.exp * 1000
                : Number.POSITIVE_INFINITY;
        rememberPlatform(
            key,
            platform,
            Math.min(tokenExpiry, now + PLATFORM_CACHE_TTL_MS),
        );
        return platform;
    } catch (error) {
        // Only a verdict on the token itself is remembered; a Registry
        // outage must not pin a good token to "no platform".
        if (error instanceof jose.errors.JOSEError) {
            rememberPlatform(key, null, now + PLATFORM_NEGATIVE_TTL_MS);
        }
        return null;
    }
}

/** Test hook: how many token verdicts are cached. */
export function cachedPlatformVerdicts(): number {
    return platformCache.size;
}

/** Test hook: forget every cached key set and verdict. */
export function resetRegistryTokenCaches(): void {
    jwksCache.clear();
    jwksInFlight.clear();
    jwksRetryAt.clear();
    platformCache.clear();
}
