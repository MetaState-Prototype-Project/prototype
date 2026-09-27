/**
 * The static client registry: which IdPs may use the connector, where they
 * may be redirected, and which optional claims they receive.
 */

import { DUMMY_HASH, isSupportedHash, verifySecret } from "./secrets.js";

export interface Client {
    clientId: string;
    secretHash: string;
    redirectUris: string[];
    /** Adds `email: <user>@w3ds.invalid` for IdPs that require one. */
    syntheticEmail: boolean;
    name?: string;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function validateRedirectUri(value: unknown, clientId: string): string {
    if (typeof value !== "string") {
        throw new Error(`client ${clientId}: redirect URIs must be strings`);
    }
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`client ${clientId}: invalid redirect URI ${value}`);
    }
    if (url.hash || value.includes("#")) {
        throw new Error(
            `client ${clientId}: redirect URI must not have a fragment`,
        );
    }
    const loopback = LOOPBACK_HOSTS.has(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
        throw new Error(
            `client ${clientId}: redirect URI must use https (http only on localhost): ${value}`,
        );
    }
    return value;
}

/** Parses and validates the JSON client list. Throws on any problem. */
export function parseClients(json: string): Client[] {
    let raw: unknown;
    try {
        raw = JSON.parse(json);
    } catch {
        throw new Error("client configuration is not valid JSON");
    }
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error("client configuration must be a non-empty array");
    }
    const seen = new Set<string>();
    return raw.map((entry, index) => {
        if (typeof entry !== "object" || entry === null) {
            throw new Error(`client #${index} must be an object`);
        }
        const record = entry as Record<string, unknown>;
        const clientId = record.client_id;
        if (typeof clientId !== "string" || clientId === "") {
            throw new Error(`client #${index}: client_id is required`);
        }
        if (seen.has(clientId)) {
            throw new Error(`client ${clientId}: duplicate client_id`);
        }
        seen.add(clientId);
        const secretHash = record.client_secret_hash;
        if (typeof secretHash !== "string" || !isSupportedHash(secretHash)) {
            throw new Error(
                `client ${clientId}: client_secret_hash must be a scrypt: or sha256: hash`,
            );
        }
        if (
            !Array.isArray(record.redirect_uris) ||
            record.redirect_uris.length === 0
        ) {
            throw new Error(`client ${clientId}: redirect_uris is required`);
        }
        const syntheticEmail = record.synthetic_email ?? false;
        if (typeof syntheticEmail !== "boolean") {
            throw new Error(
                `client ${clientId}: synthetic_email must be a boolean`,
            );
        }
        if (record.name !== undefined && typeof record.name !== "string") {
            throw new Error(`client ${clientId}: name must be a string`);
        }
        return {
            clientId,
            secretHash,
            redirectUris: record.redirect_uris.map((uri) =>
                validateRedirectUri(uri, clientId),
            ),
            syntheticEmail,
            name: record.name as string | undefined,
        };
    });
}

export interface ClientCredentials {
    authorization?: string;
    body?: Record<string, unknown>;
}

export type ClientAuthentication =
    | { ok: true; client: Client }
    | { ok: false; error: "invalid_client" | "invalid_request" };

export class ClientRegistry {
    private readonly clients: Map<string, Client>;

    constructor(clients: Client[]) {
        this.clients = new Map(clients.map((c) => [c.clientId, c]));
    }

    get(clientId: string): Client | undefined {
        return this.clients.get(clientId);
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
        const client = this.clients.get(clientId);
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
