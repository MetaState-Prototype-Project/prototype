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

// cwd is services/acl-demo under both `vite dev` and `node build/index.js`.
loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

function raw(name: string): string {
	return (env[name] ?? process.env[name] ?? "").trim();
}

export function registryUrl(): string {
	const url = raw("REGISTRY_URL") || raw("PUBLIC_REGISTRY_URL");
	if (!url) throw new Error("PUBLIC_REGISTRY_URL is required");
	return url;
}

export function provisionerUrl(): string {
	return raw("PUBLIC_PROVISIONER_URL") || "https://provisioner.w3ds.metastate.foundation";
}

export function ontologyUrl(): string {
	return raw("PUBLIC_ONTOLOGY_URL") || "https://ontology.w3ds.metastate.foundation";
}

/**
 * The verification code that lets provisioning skip KYC.
 *
 * Matches the fallback in evault-core's ProvisioningService, so the demo works
 * against a network that has not set the variable.
 */
export function demoCode(): string {
	return raw("DEMO_CODE_W3DS") || "d66b7138-538a-465f-a6ce-f6985854c3f4";
}

/**
 * Where the provisioned cast is remembered between restarts.
 *
 * A configured relative path is read from the repo root, the same place the
 * `.env` naming it lives — resolving it against this app's working directory
 * would make `services/acl-demo/.cast.json` mean something one level too deep.
 */
export function castFile(): string {
	const configured = raw("ACL_DEMO_CAST_FILE");
	if (!configured) return path.resolve(process.cwd(), ".cast.json");
	return path.resolve(process.cwd(), "../../", configured);
}
