import type { RequestHandler } from "express";
import type { BridgeContext } from "../context.js";

/**
 * The discovery document Forgejo fetches once, at the moment an administrator
 * saves the authentication source.
 *
 * goth does no validation here at all — it unmarshals the JSON into a struct
 * with five fields and moves on. Everything beyond those five is for
 * conformance and for whoever reads it next.
 */
export function buildDiscoveryDocument(issuer: string) {
    return {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        // goth skips the userinfo request entirely when this is absent. We serve
        // it, which obliges us to keep its `sub` identical to the ID token's.
        userinfo_endpoint: `${issuer}/userinfo`,
        jwks_uri: `${issuer}/jwks`,

        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["ES256"],
        scopes_supported: ["openid", "profile", "email"],
        // golang.org/x/oauth2 tries Basic first and falls back to form fields, so
        // both are advertised and both are accepted.
        token_endpoint_auth_methods_supported: [
            "client_secret_basic",
            "client_secret_post",
        ],
        // No `plain`. Forgejo sends S256, so there is no reason to accept less.
        code_challenge_methods_supported: ["S256"],
        claims_supported: [
            "sub",
            "iss",
            "aud",
            "exp",
            "iat",
            "nonce",
            "nickname",
            "preferred_username",
            "email",
            "email_verified",
        ],
    };
}

export function createDiscoveryHandler(ctx: BridgeContext): RequestHandler {
    return (_req, res) => {
        res.json(buildDiscoveryDocument(ctx.config.publicUrl));
    };
}

export function createJwksHandler(ctx: BridgeContext): RequestHandler {
    return (_req, res) => {
        res.json(ctx.keyring.jwks);
    };
}
