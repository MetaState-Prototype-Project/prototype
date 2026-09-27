export interface Config {
    port: number;
    /** Public origin of the connector, without a trailing slash. */
    issuer: string;
    /** Shown in the wallet and on the login page. */
    platformName: string;
    registryUrl: string;
    /** ES256 private JWK as JSON; unset generates an ephemeral key in dev. */
    signingKeyJwk?: string;
    /** Postgres connection string for the client registry. */
    databaseUrl: string;
    /** CA certificate for the Postgres connection, if it uses TLS. */
    dbCaCert?: string;
    sessionTtlSeconds: number;
    codeTtlSeconds: number;
    tokenTtlSeconds: number;
    upstreamTimeoutMs: number;
    jwksCacheSeconds: number;
    /** Passed to Express's "trust proxy" setting. */
    trustProxy: boolean | number | string;
    production: boolean;
}

type Env = Record<string, string | undefined>;

function positiveInteger(env: Env, name: string, fallback: number): number {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
    return value;
}

/**
 * The issuer must be a bare origin: the wallet's mobile deep link builds
 * `new URL("/deeplink-login", redirect)`, which drops any path prefix.
 */
function parseIssuer(raw: string | undefined, production: boolean): string {
    if (!raw) throw new Error("W3DS_OIDC_ISSUER is required");
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error("W3DS_OIDC_ISSUER must be an absolute URL");
    }
    if (url.pathname !== "/" || url.search || url.hash) {
        throw new Error(
            "W3DS_OIDC_ISSUER must be an origin with no path, query or fragment",
        );
    }
    if (url.protocol !== "https:" && (production || url.protocol !== "http:")) {
        throw new Error("W3DS_OIDC_ISSUER must use https in production");
    }
    return url.origin;
}

function parseTrustProxy(raw: string | undefined): boolean | number | string {
    if (raw === undefined || raw === "" || raw === "false") return false;
    if (raw === "true") return true;
    if (/^\d+$/.test(raw)) return Number(raw);
    return raw;
}

export function loadConfig(env: Env = process.env): Config {
    const production = env.NODE_ENV === "production";
    const registryUrl = env.PUBLIC_REGISTRY_URL || env.REGISTRY_URL;
    if (!registryUrl) throw new Error("PUBLIC_REGISTRY_URL is required");
    const databaseUrl = env.W3DS_OIDC_DATABASE_URL;
    if (!databaseUrl) throw new Error("W3DS_OIDC_DATABASE_URL is required");
    return {
        port: positiveInteger(env, "W3DS_OIDC_PORT", 4200),
        issuer: parseIssuer(env.W3DS_OIDC_ISSUER, production),
        platformName: env.W3DS_OIDC_PLATFORM_NAME || "W3DS Login",
        registryUrl,
        signingKeyJwk: env.W3DS_OIDC_SIGNING_KEY_JWK || undefined,
        databaseUrl,
        dbCaCert: env.DB_CA_CERT || undefined,
        sessionTtlSeconds: positiveInteger(
            env,
            "W3DS_OIDC_SESSION_TTL_SECONDS",
            300,
        ),
        codeTtlSeconds: positiveInteger(env, "W3DS_OIDC_CODE_TTL_SECONDS", 60),
        tokenTtlSeconds: positiveInteger(
            env,
            "W3DS_OIDC_TOKEN_TTL_SECONDS",
            300,
        ),
        upstreamTimeoutMs: positiveInteger(
            env,
            "W3DS_OIDC_UPSTREAM_TIMEOUT_MS",
            5000,
        ),
        jwksCacheSeconds: positiveInteger(
            env,
            "W3DS_OIDC_JWKS_CACHE_SECONDS",
            300,
        ),
        trustProxy: parseTrustProxy(env.W3DS_OIDC_TRUST_PROXY),
        production,
    };
}
