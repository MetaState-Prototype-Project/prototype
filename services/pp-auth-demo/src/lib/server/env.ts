import path from "node:path";
import { config as loadEnv } from "dotenv";
import { env } from "$env/dynamic/private";

/**
 * Configuration, read from the repo-root .env in one place.
 *
 * Deliberately avoids `$env/dynamic/public`: several shared variables in this
 * monorepo carry SvelteKit's PUBLIC_ prefix, and importing that module
 * serialises the whole public block — every service URL and credential — into
 * the HTML of every page. Nothing here is needed in the browser.
 */

// cwd is services/pp-auth-demo under both `vite dev` and `node build/index.js`.
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

function raw(name: string): string {
	return (env[name] ?? process.env[name] ?? "").trim();
}

/** Public base URL of this app — the w3ds:// callback target. */
export function publicUrl(): string {
	return raw("PP_AUTH_DEMO_PUBLIC_URL") || "http://localhost:4310";
}

export function registryUrl(): string {
	const url = raw("REGISTRY_URL") || raw("PUBLIC_REGISTRY_URL");
	if (!url) throw new Error("PUBLIC_REGISTRY_URL is required");
	return url;
}

export function awarenessUrl(): string {
	return raw("AWARENESS_SERVICE_URL") || "https://aaas.w3ds.metastate.foundation";
}

export function awarenessApiKey(): string {
	return raw("PP_AUTH_DEMO_AWARENESS_API_KEY") || raw("PPA_AWARENESS_API_KEY") || raw("AWARENESS_API_KEY");
}

export function ontologyUrl(): string {
	return raw("PUBLIC_ONTOLOGY_URL") || "https://ontology.w3ds.metastate.foundation";
}

export function ereputationUrl(): string {
	return raw("PPA_EREPUTATION_URL") || "https://ereputation.w3ds.metastate.foundation";
}

/**
 * The reputation service whose scores terms are written against.
 *
 * There is exactly one, so asking an owner to type its address is asking them
 * to get it wrong. When a second exists this becomes a choice again.
 */
export function reputationEngine(): string {
	return new URL(ereputationUrl()).host;
}

export function jwtSecret(): string {
	return raw("PP_AUTH_DEMO_JWT_SECRET") || raw("PPA_JWT_SECRET") || "pp-auth-demo-dev-secret";
}

/** Name this app presents to the registry when minting its read token. */
export const PLATFORM_NAME = "pp-auth-demo";
