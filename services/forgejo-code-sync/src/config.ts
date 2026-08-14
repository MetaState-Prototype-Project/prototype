import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

export interface SyncConfig {
    /** This service's own base URL, used for Registry platform certification. */
    publicUrl: string;
    port: number;
    /** HMAC secret configured on the Forgejo system webhook. */
    webhookSecret: string;
    /** GitW3's base URL, for the admin Users API call and diff fetching. */
    forgejoApiUrl: string;
    /**
     * PAT on a dedicated site-admin service account, scopes read:user,read:repository.
     * read:user alone is not enough - login_name is only returned to a caller whose
     * account has IsAdmin=true, regardless of token scope. See the spec's Trust model.
     */
    forgejoAdminToken: string;
    /** Diffs larger than this are stored as a diffUrl pointer instead of inlined. */
    diffMaxBytes: number;
    registryUrl: string;
    evaultServerUri: string;
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
 * Throws rather than degrading, matching the bridge's own config.ts - a service
 * that starts with a missing admin token fails later, at a point where the
 * symptom (an unresolved eName on every push) no longer points at the cause.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): SyncConfig {
    const port = Number(optional(env, "FORGEJO_SYNC_PORT", "4300"));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new ConfigError(
            `FORGEJO_SYNC_PORT must be an integer between 1 and 65535: ${env.FORGEJO_SYNC_PORT}`,
        );
    }

    const diffMaxBytes = Number(
        optional(env, "FORGEJO_SYNC_DIFF_MAX_BYTES", "131072"),
    );
    if (!Number.isInteger(diffMaxBytes) || diffMaxBytes < 0) {
        throw new ConfigError(
            `FORGEJO_SYNC_DIFF_MAX_BYTES must be a non-negative integer: ${env.FORGEJO_SYNC_DIFF_MAX_BYTES}`,
        );
    }

    return {
        publicUrl: required(env, "FORGEJO_SYNC_PUBLIC_URL").replace(/\/+$/, ""),
        port,
        webhookSecret: required(env, "FORGEJO_WEBHOOK_SECRET"),
        forgejoApiUrl: required(env, "FORGEJO_API_URL").replace(/\/+$/, ""),
        forgejoAdminToken: required(env, "FORGEJO_ADMIN_TOKEN"),
        diffMaxBytes,
        registryUrl: required(env, "PUBLIC_REGISTRY_URL"),
        evaultServerUri: required(env, "PUBLIC_EVAULT_SERVER_URI").replace(
            /\/+$/,
            "",
        ),
    };
}

let cached: SyncConfig | undefined;

/** Memoised singleton for the running service. Loads the repository root `.env`. */
export function getConfig(): SyncConfig {
    if (!cached) {
        const here = path.dirname(fileURLToPath(import.meta.url));
        // src/ during development, dist/ once built - both sit one level under
        // the package, so the same relative path reaches the repository root.
        loadEnv({ path: path.resolve(here, "../../../.env") });
        cached = loadConfig();
    }
    return cached;
}
