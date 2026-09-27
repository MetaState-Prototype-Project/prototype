/**
 * OIDC clients: how they are identified, validated and authenticated.
 * Clients are self-service; see client-store.ts for where they live.
 */

import { createHash, randomBytes } from "node:crypto";
import type { ClientRecord, ClientRepository } from "./client-store.js";
import { DUMMY_HASH, verifySecret } from "./secrets.js";

export type Client = ClientRecord;

export const MAX_NAME_LENGTH = 64;
export const MAX_REDIRECT_URIS = 10;
const MAX_REDIRECT_URI_LENGTH = 2048;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function generateClientId(): string {
    return `w3ds_${randomBytes(16).toString("base64url")}`;
}

export function generateClientSecret(): string {
    return randomBytes(32).toString("base64url");
}

/**
 * Generated secrets carry 256 bits of entropy, so a fast hash is enough:
 * there is nothing for a slow hash to protect against guessing.
 */
export function hashClientSecret(secret: string): string {
    return `sha256:${createHash("sha256").update(secret, "utf8").digest("hex")}`;
}

/** Returns an error message, or null if `value` is an acceptable redirect URI. */
export function redirectUriError(value: string): string | null {
    if (value.length > MAX_REDIRECT_URI_LENGTH) {
        return "Redirect URIs must be at most 2048 characters.";
    }
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return `${value} is not a valid URL.`;
    }
    if (url.hash || value.includes("#")) {
        return `${value} must not contain a fragment (#).`;
    }
    const loopback = LOOPBACK_HOSTS.has(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
        return `${value} must use https (http is allowed only on localhost).`;
    }
    return null;
}

export interface ClientInput {
    name: string;
    redirectUris: string[];
    syntheticEmail: boolean;
}

export type ClientInputResult =
    | { ok: true; value: ClientInput }
    | { ok: false; errors: string[] };

/**
 * Validates a client as submitted from the portal. Redirect URIs arrive as
 * one per line and are trimmed and de-duplicated.
 */
export function validateClientInput(raw: {
    name?: unknown;
    redirectUris?: unknown;
    syntheticEmail?: unknown;
}): ClientInputResult {
    const errors: string[] = [];
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    if (name === "") errors.push("Give the client a name.");
    else if (name.length > MAX_NAME_LENGTH) {
        errors.push(`The name must be at most ${MAX_NAME_LENGTH} characters.`);
    }

    const lines =
        typeof raw.redirectUris === "string"
            ? raw.redirectUris.split(/\r?\n/)
            : Array.isArray(raw.redirectUris)
              ? raw.redirectUris.filter((v): v is string => typeof v === "string")
              : [];
    const redirectUris = [
        ...new Set(lines.map((line) => line.trim()).filter(Boolean)),
    ];
    if (redirectUris.length === 0) {
        errors.push("Add at least one redirect URI.");
    } else if (redirectUris.length > MAX_REDIRECT_URIS) {
        errors.push(`A client can have at most ${MAX_REDIRECT_URIS} redirect URIs.`);
    }
    for (const uri of redirectUris) {
        const error = redirectUriError(uri);
        if (error) errors.push(error);
    }

    const syntheticEmail =
        raw.syntheticEmail === true ||
        raw.syntheticEmail === "on" ||
        raw.syntheticEmail === "true";

    return errors.length > 0
        ? { ok: false, errors }
        : { ok: true, value: { name, redirectUris, syntheticEmail } };
}

export interface ClientCredentials {
    authorization?: string;
    body?: Record<string, unknown>;
}

export type ClientAuthentication =
    | { ok: true; client: Client }
    | { ok: false; error: "invalid_client" | "invalid_request" };

export class ClientRegistry {
    constructor(readonly repository: ClientRepository) {}

    async get(clientId: string): Promise<Client | undefined> {
        return (await this.repository.findByClientId(clientId)) ?? undefined;
    }

    /**
     * Authenticates a client by `client_secret_basic` or `client_secret_post`
     * (RFC 6749 §2.3.1). Presenting both at once is a malformed request.
     */
    async authenticate(
        credentials: ClientCredentials,
    ): Promise<ClientAuthentication> {
        const basic = parseBasic(credentials.authorization);
        const bodyId = credentials.body?.client_id;
        const bodySecret = credentials.body?.client_secret;
        if (basic === "malformed") return { ok: false, error: "invalid_client" };
        if (basic && bodySecret !== undefined) {
            return { ok: false, error: "invalid_request" };
        }
        let clientId: unknown;
        let secret: unknown;
        if (basic) {
            ({ clientId, secret } = basic);
            if (bodyId !== undefined && bodyId !== clientId) {
                return { ok: false, error: "invalid_request" };
            }
        } else {
            clientId = bodyId;
            secret = bodySecret;
        }
        if (typeof clientId !== "string" || typeof secret !== "string") {
            return { ok: false, error: "invalid_client" };
        }
        const client =
            clientId.length <= 256 ? await this.get(clientId) : undefined;
        // Check a dummy hash for unknown clients, so a failed lookup costs
        // the same as a wrong secret.
        const valid = await verifySecret(
            secret,
            client?.secretHash ?? DUMMY_HASH,
        );
        return client && valid
            ? { ok: true, client }
            : { ok: false, error: "invalid_client" };
    }
}

function parseBasic(
    header: string | undefined,
): { clientId: string; secret: string } | "malformed" | null {
    if (!header) return null;
    const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header);
    if (!match) return /^Basic\b/i.test(header) ? "malformed" : null;
    const decoded = Buffer.from(match[1], "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return "malformed";
    try {
        return {
            clientId: decodeURIComponent(
                decoded.slice(0, separator).replace(/\+/g, " "),
            ),
            secret: decodeURIComponent(
                decoded.slice(separator + 1).replace(/\+/g, " "),
            ),
        };
    } catch {
        return "malformed";
    }
}
