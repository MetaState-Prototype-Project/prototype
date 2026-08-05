import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

export interface BridgeConfig {
    /**
     * The OIDC `issuer`. goth compares this byte for byte against the `iss` claim
     * of every ID token, so it is normalised once here — a trailing slash that
     * only appears on one side of that comparison fails every login with no
     * useful error.
     */
    publicUrl: string;
    port: number;
    clientId: string;
    clientSecret: string;
    /** GitW3's callback. Compared exactly; never by prefix. */
    redirectUri: string;
    /** ES256 private key, PKCS#8 PEM. */
    signingKey: string;
    keyId: string;
    /** Domain for synthetic addresses. These never deliver — see the spec. */
    emailDomain: string;
    /** Lower-cased, on top of the names Forgejo already reserves. */
    extraReservedUsernames: string[];
    minWalletVersion: string;
    registryUrl: string;
}

export class ConfigError extends Error {}

function required(env: NodeJS.ProcessEnv, name: string): string {
    const value = env[name]?.trim();
    if (!value) {
        throw new ConfigError(`Missing required environment variable: ${name}`);
    }
    return value;
}

function optional(
    env: NodeJS.ProcessEnv,
    name: string,
    fallback: string,
): string {
    const value = env[name]?.trim();
    return value ? value : fallback;
}

/**
 * Builds the configuration from an environment. Pure: it reads nothing but the
 * map it is handed, so tests do not have to mutate `process.env`.
 *
 * Throws rather than degrading. Every value here is load-bearing, and a bridge
 * that starts with a wrong issuer or a missing key fails later, at a point where
 * the symptom no longer points at the cause.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
    const rawPublicUrl = required(env, "W3DS_OIDC_PUBLIC_URL");

    let parsed: URL;
    try {
        parsed = new URL(rawPublicUrl);
    } catch {
        throw new ConfigError(
            `W3DS_OIDC_PUBLIC_URL is not a valid absolute URL: ${rawPublicUrl}`,
        );
    }

    const allowInsecure =
        optional(env, "W3DS_OIDC_ALLOW_INSECURE", "false") === "true";
    if (parsed.protocol !== "https:" && !allowInsecure) {
        // goth never verifies the ID token signature (see the spec's trust model),
        // so TLS plus the client secret is the only thing separating a real token
        // from a forged one. The unsafe case has to be chosen, never inherited.
        throw new ConfigError(
            `W3DS_OIDC_PUBLIC_URL must be https:// — got ${parsed.protocol}//. Set W3DS_OIDC_ALLOW_INSECURE=true only for local development.`,
        );
    }

    const port = Number(optional(env, "W3DS_OIDC_PORT", "4200"));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ConfigError(
            `W3DS_OIDC_PORT must be an integer between 1 and 65535: ${env.W3DS_OIDC_PORT}`,
        );
    }

    return {
        publicUrl: rawPublicUrl.replace(/\/+$/, ""),
        port,
        clientId: required(env, "W3DS_OIDC_CLIENT_ID"),
        clientSecret: required(env, "W3DS_OIDC_CLIENT_SECRET"),
        redirectUri: required(env, "W3DS_OIDC_REDIRECT_URI"),
        signingKey: required(env, "W3DS_OIDC_SIGNING_KEY"),
        keyId: required(env, "W3DS_OIDC_KEY_ID"),
        emailDomain: optional(env, "W3DS_EMAIL_DOMAIN", "w3ds.invalid"),
        extraReservedUsernames: optional(
            env,
            "W3DS_EXTRA_RESERVED_USERNAMES",
            "",
        )
            .split(",")
            .map((name) => name.trim().toLowerCase())
            .filter(Boolean),
        minWalletVersion: optional(env, "W3DS_MIN_WALLET_VERSION", "0.4.0"),
        registryUrl: required(env, "PUBLIC_REGISTRY_URL"),
    };
}

let cached: BridgeConfig | undefined;

/** Memoised singleton for the running service. Loads the repository root `.env`. */
export function getConfig(): BridgeConfig {
    if (!cached) {
        const here = path.dirname(fileURLToPath(import.meta.url));
        // src/ during development, dist/ once built — both sit one level under
        // the package, so the same relative path reaches the repository root.
        loadEnv({ path: path.resolve(here, "../../../.env") });
        cached = loadConfig();
    }
    return cached;
}
