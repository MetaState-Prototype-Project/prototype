import path from "node:path";
import { config as loadEnv } from "dotenv";
import { env } from "$env/dynamic/private";

/**
 * Every value the PPA reads out of the repo-root .env, resolved in one place.
 *
 * Deliberately does NOT use `$env/dynamic/public`. Several shared variables in
 * this monorepo carry SvelteKit's PUBLIC_ prefix, and importing that module
 * serialises the whole public env block — every service URL in the ecosystem,
 * credentials included — into the HTML of every page, signed in or not. Nothing
 * here is needed in the browser, so the root .env is loaded directly and all
 * configuration stays on the server.
 */

// cwd is services/ppa under both `vite dev` and `node build/index.js`.
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

function raw(name: string): string {
    return (env[name] ?? process.env[name] ?? "").trim();
}

/** Public base URL of this app — the w3ds://auth callback and JWS issuer. */
export function publicUrl(): string {
    return raw("PPA_PUBLIC_URL") || raw("PUBLIC_PPA_URL") || "http://localhost:4210";
}

export function registryUrl(): string {
    const url = raw("REGISTRY_URL") || raw("PUBLIC_REGISTRY_URL");
    if (!url) throw new Error("PUBLIC_REGISTRY_URL is required");
    return url;
}

export function provisionerUrl(): string {
    return raw("PUBLIC_PROVISIONER_URL") || "http://localhost:3001";
}

/** Ontology service — publisher of the schemas and the domain list. */
export function ontologyUrl(): string {
    return raw("PUBLIC_ONTOLOGY_URL") || "https://ontology.w3ds.metastate.foundation";
}

/** eReputation service — signed references about people and platforms. */
export function ereputationUrl(): string {
    return raw("PPA_EREPUTATION_URL") || "https://ereputation.w3ds.metastate.foundation";
}

export function awarenessUrl(): string {
    return raw("AWARENESS_SERVICE_URL") || "http://localhost:4100";
}

/** PPA's own AaaS consumer key, falling back to the shared one. */
export function awarenessApiKey(): string {
    return raw("PPA_AWARENESS_API_KEY") || raw("AWARENESS_API_KEY");
}

export function jwtSecret(): string {
    return raw("PPA_JWT_SECRET") || "ppa-dev-secret";
}

export function signingJwk(): string {
    return raw("PPA_SIGNING_JWK");
}

export function adminEnamesFile(): string {
    return raw("PPA_ADMIN_ENAMES_FILE") || "config/admin-enames.json";
}

export function adminEnamesCsv(): string {
    return raw("PPA_ADMIN_ENAMES");
}

/** Slug of the messenger platform to look up in AaaS for the contact button. */
export function messengerPlatformName(): string {
    return raw("PPA_MESSENGER_PLATFORM_NAME") || "meshenger";
}

/**
 * Path on the messenger that opens a conversation with one person, with
 * `{ename}` substituted. Only used when the messenger declares no handle for
 * the User ontology — a declared handle always wins, since that is the
 * messenger describing itself rather than us assuming.
 */
export function messengerContactPath(): string {
    return raw("PPA_MESSENGER_CONTACT_PATH") || "/contacts/{ename}";
}

/**
 * Base URL of the forge hosting submitted repositories. The signed release
 * statement carries `owner/name` but no host, so a link can only be built
 * with this. Left unset the repository stays plain text rather than pointing
 * at a guessed address.
 */
export function repositoryBaseUrl(): string {
    return raw("PPA_REPOSITORY_BASE_URL");
}

export function demoVerificationCode(): string {
    return raw("DEMO_VERIFICATION_CODE");
}
