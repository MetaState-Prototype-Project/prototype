import type { Client } from "./clients.js";
import type { Identity } from "./types.js";

/**
 * A username suggestion derived from the eName. Not guaranteed unique (two
 * eNames can sanitise alike), which is why IdPs must key accounts on `sub`.
 */
export function sanitizeUsername(eName: string): string {
    const cleaned = eName
        .normalize("NFKC")
        .replace(/^@+/, "")
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^[-._]+|[-._]+$/g, "")
        .slice(0, 64)
        .replace(/[-._]+$/, "");
    return cleaned || "w3ds-user";
}

/**
 * The claims describing the user, shared by the ID token and /userinfo.
 * The `.invalid` TLD is reserved (RFC 2606), so the synthetic email can never
 * receive mail, and `email_verified: false` stops IdPs linking accounts on it.
 */
export function userClaims(
    identity: Identity,
    client: Pick<Client, "syntheticEmail">,
): Record<string, unknown> {
    const username = sanitizeUsername(identity.eName);
    return {
        sub: identity.eName,
        preferred_username: username,
        amr: identity.amr,
        auth_time: identity.authTime,
        ...(client.syntheticEmail && {
            email: `${username}@w3ds.invalid`,
            email_verified: false,
        }),
    };
}

export function idTokenClaims(options: {
    identity: Identity;
    client: Pick<Client, "clientId" | "syntheticEmail">;
    issuer: string;
    nonce?: string;
    nowSeconds: number;
    ttlSeconds: number;
}): Record<string, unknown> {
    return {
        iss: options.issuer,
        aud: options.client.clientId,
        iat: options.nowSeconds,
        exp: options.nowSeconds + options.ttlSeconds,
        ...(options.nonce !== undefined && { nonce: options.nonce }),
        ...userClaims(options.identity, options.client),
    };
}
