import express, { Router } from "express";
import type { AppDeps } from "../app.js";
import { idTokenClaims, userClaims } from "../claims.js";
import { oauthError } from "../http/errors.js";
import { log } from "../log.js";
import { verifyS256 } from "../pkce.js";

export function tokenRouter(deps: AppDeps): Router {
    const router = Router();

    router.post(
        "/token",
        express.urlencoded({ extended: false, limit: "16kb" }),
        async (req, res, next) => {
            try {
                const body = (req.body ?? {}) as Record<string, unknown>;
                const auth = await deps.clients.authenticate({
                    authorization: req.headers.authorization,
                    body,
                });
                if (!auth.ok) {
                    if (auth.error === "invalid_request") {
                        return oauthError(res, 400, "invalid_request", "use one client authentication method");
                    }
                    res.setHeader("WWW-Authenticate", 'Basic realm="w3ds-oidc", charset="UTF-8"');
                    return oauthError(res, 401, "invalid_client");
                }
                const { client } = auth;

                if (body.grant_type !== "authorization_code") {
                    return oauthError(res, 400, "unsupported_grant_type");
                }
                if (typeof body.code !== "string" || body.code === "") {
                    return oauthError(res, 400, "invalid_request", "code is required");
                }

                // Burn the code before anything else can fail, so a leaked
                // code is spent whether or not the attacker gets it right.
                const now = deps.now();
                const consumed = deps.codes.consume(body.code, now);
                if (consumed.status === "replayed") {
                    for (const token of consumed.accessTokens) {
                        deps.tokens.revoke(token);
                    }
                    log.warn(`authorization code replayed by client ${client.clientId}`);
                    return oauthError(res, 400, "invalid_grant", "code already used");
                }
                if (consumed.status === "invalid") {
                    return oauthError(res, 400, "invalid_grant", "code is invalid or expired");
                }
                const { record } = consumed;
                if (record.clientId !== client.clientId) {
                    return oauthError(res, 400, "invalid_grant", "code was issued to another client");
                }
                if (body.redirect_uri !== record.redirectUri) {
                    return oauthError(res, 400, "invalid_grant", "redirect_uri does not match");
                }
                if (!verifyS256(body.code_verifier, record.codeChallenge)) {
                    return oauthError(res, 400, "invalid_grant", "code_verifier does not match");
                }

                const nowSeconds = Math.floor(now / 1000);
                const idToken = await deps.keys.sign(
                    idTokenClaims({
                        identity: record.identity,
                        client,
                        scope: record.scope,
                        issuer: deps.config.issuer,
                        nonce: record.nonce,
                        nowSeconds,
                        ttlSeconds: deps.config.tokenTtlSeconds,
                    }),
                );
                const accessToken = deps.tokens.issue(
                    client.clientId,
                    userClaims(record.identity, client, record.scope),
                    now,
                );
                deps.codes.recordAccessToken(body.code, accessToken);
                deps.clients.repository
                    .touchLastUsed(client.clientId, new Date(now))
                    .catch((error) =>
                        log.warn(
                            "could not record client use:",
                            error instanceof Error ? error.message : error,
                        ),
                    );

                res.setHeader("Cache-Control", "no-store");
                res.setHeader("Pragma", "no-cache");
                res.json({
                    access_token: accessToken,
                    token_type: "Bearer",
                    expires_in: deps.config.tokenTtlSeconds,
                    id_token: idToken,
                    scope: record.scope.join(" "),
                });
            } catch (error) {
                next(error);
            }
        },
    );

    return router;
}
