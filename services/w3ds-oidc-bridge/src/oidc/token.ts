import { createHash } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { buildClaims } from "../claims.js";
import type { BridgeContext } from "../context.js";

/** Long enough for Forgejo to fetch userinfo, short enough not to matter if leaked. */
export const TOKEN_TTL_SECONDS = 300;

/** OAuth2 error codes, so a failure is diagnosable rather than a bare 400. */
type TokenErrorCode =
    | "invalid_request"
    | "invalid_client"
    | "invalid_grant"
    | "unsupported_grant_type";

interface Credentials {
    clientId?: string;
    clientSecret?: string;
}

/**
 * Reads client credentials from either place the spec allows.
 *
 * golang.org/x/oauth2 — which Forgejo uses — defaults to `AuthStyleAutoDetect`:
 * it tries HTTP Basic first and retries with form fields if that fails. Handling
 * only one of the two would work until it silently didn't.
 */
function readCredentials(req: Request): Credentials {
    const header = req.header("authorization");

    if (header?.toLowerCase().startsWith("basic ")) {
        const decoded = Buffer.from(header.slice(6).trim(), "base64").toString(
            "utf8",
        );
        const separator = decoded.indexOf(":");
        if (separator !== -1) {
            // RFC 6749 §2.3.1 form-urlencodes both halves before base64, and Go's
            // oauth2 client does exactly that.
            const decode = (value: string) => {
                try {
                    return decodeURIComponent(value.replace(/\+/g, " "));
                } catch {
                    return value;
                }
            };
            return {
                clientId: decode(decoded.slice(0, separator)),
                clientSecret: decode(decoded.slice(separator + 1)),
            };
        }
    }

    const body = req.body as Record<string, unknown> | undefined;
    return {
        clientId:
            typeof body?.client_id === "string" ? body.client_id : undefined,
        clientSecret:
            typeof body?.client_secret === "string"
                ? body.client_secret
                : undefined,
    };
}

/** base64url(sha256(verifier)) — the S256 transform, and the only one accepted. */
export function computeS256Challenge(verifier: string): string {
    return createHash("sha256").update(verifier).digest("base64url");
}

export function createTokenHandler(ctx: BridgeContext): RequestHandler {
    return async (req, res) => {
        const fail = (
            status: number,
            error: TokenErrorCode,
            description: string,
        ) => {
            // The token endpoint must not be cached by anything, ever.
            res.status(status)
                .set("Cache-Control", "no-store")
                .json({ error, error_description: description });
        };

        const body = (req.body ?? {}) as Record<string, unknown>;
        const field = (name: string): string | undefined =>
            typeof body[name] === "string" ? (body[name] as string) : undefined;

        if (field("grant_type") !== "authorization_code") {
            return fail(
                400,
                "unsupported_grant_type",
                "Only the authorization_code grant is supported",
            );
        }

        const credentials = readCredentials(req);
        const client = ctx.clients.find(credentials.clientId);
        if (
            !client ||
            !ctx.clients.authenticate(client, credentials.clientSecret)
        ) {
            // Same answer for an unknown client and a wrong secret: distinguishing
            // them tells an attacker which half to keep guessing.
            return fail(401, "invalid_client", "Client authentication failed");
        }

        const code = field("code");
        if (!code) return fail(400, "invalid_request", "Missing code");

        // Consumed as it is read, so a replay finds nothing.
        const grant = ctx.store.codes.take(code);
        if (!grant) {
            return fail(
                400,
                "invalid_grant",
                "Unknown, expired or already redeemed code",
            );
        }

        if (grant.clientId !== client.clientId) {
            return fail(
                400,
                "invalid_grant",
                "Code was not issued to this client",
            );
        }

        if (field("redirect_uri") !== grant.redirectUri) {
            return fail(
                400,
                "invalid_grant",
                "redirect_uri does not match the authorization request",
            );
        }

        const verifier = field("code_verifier");
        if (!verifier)
            return fail(400, "invalid_request", "Missing code_verifier");
        if (computeS256Challenge(verifier) !== grant.codeChallenge) {
            return fail(
                400,
                "invalid_grant",
                "code_verifier does not match the code_challenge",
            );
        }

        const claims = buildClaims(grant.ename, {
            emailDomain: ctx.config.emailDomain,
            extraReservedUsernames: ctx.config.extraReservedUsernames,
        });

        const idToken = await ctx.keyring.sign(
            {
                ...claims,
                aud: client.clientId,
                // goth does not check the nonce, but a future client would, and
                // dropping it here would be silent.
                ...(grant.nonce ? { nonce: grant.nonce } : {}),
            },
            TOKEN_TTL_SECONDS,
        );

        // A JWT rather than a random string, so /userinfo needs no third map. Its
        // audience is the bridge itself, which is the resource being accessed.
        const accessToken = await ctx.keyring.sign(
            { sub: claims.sub, aud: ctx.config.publicUrl },
            TOKEN_TTL_SECONDS,
        );

        res.set("Cache-Control", "no-store").json({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: TOKEN_TTL_SECONDS,
            id_token: idToken,
            scope: "openid profile email",
        });
    };
}
