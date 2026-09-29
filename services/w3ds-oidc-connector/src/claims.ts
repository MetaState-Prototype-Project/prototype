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
 *
 * Only standard claims, because an IdP between the connector and the app
 * replaces `sub` with its own ID and passes on little else. The eName
 * survives as `preferred_username`, which is lossless for UUID eNames.
 *
 * Email and names come from the user's eVault profile. The profile is
 * self-asserted, so `email_verified` is always false: IdPs must not link
 * accounts on it. When there is no email to give, clients that need one get
 * a synthetic address under the reserved `.invalid` TLD (RFC 2606), which
 * can never receive mail.
 */
export function userClaims(
    identity: Identity,
    client: Pick<Client, "syntheticEmail">,
    scope: readonly string[],
): Record<string, unknown> {
    const username = sanitizeUsername(identity.eName);
    const profile = identity.profile ?? {};
    const email =
        scope.includes("email") || client.syntheticEmail
            ? (profile.email ??
              (client.syntheticEmail ? `${username}@w3ds.invalid` : undefined))
            : undefined;
    const names = scope.includes("profile")
        ? {
              ...(profile.name && { name: profile.name }),
              ...(profile.givenName && { given_name: profile.givenName }),
              ...(profile.familyName && { family_name: profile.familyName }),
          }
        : {};
    return {
        sub: identity.eName,
        preferred_username: username,
        ...names,
        amr: identity.amr,
        auth_time: identity.authTime,
        ...(email && { email, email_verified: false }),
    };
}

export function idTokenClaims(options: {
    identity: Identity;
    client: Pick<Client, "clientId" | "syntheticEmail">;
    scope: readonly string[];
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
        ...userClaims(options.identity, options.client, options.scope),
    };
}
