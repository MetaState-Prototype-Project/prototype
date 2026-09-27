import { type Request, type Response, Router } from "express";
import type { AppDeps } from "../app.js";
import { LOGO_PNG } from "../assets/logo.js";

export const SUPPORTED_SCOPES = ["openid", "profile", "email"];

export const SUPPORTED_CLAIMS = [
    "iss",
    "sub",
    "aud",
    "exp",
    "iat",
    "auth_time",
    "nonce",
    "amr",
    "preferred_username",
    "email",
    "email_verified",
];

export function discoveryDocument(issuer: string) {
    return {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        userinfo_endpoint: `${issuer}/userinfo`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ["code"],
        response_modes_supported: ["query"],
        grant_types_supported: ["authorization_code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["ES256"],
        token_endpoint_auth_methods_supported: [
            "client_secret_basic",
            "client_secret_post",
        ],
        code_challenge_methods_supported: ["S256"],
        scopes_supported: SUPPORTED_SCOPES,
        claims_supported: SUPPORTED_CLAIMS,
        authorization_response_iss_parameter_supported: true,
        request_parameter_supported: false,
        request_uri_parameter_supported: false,
        claims_parameter_supported: false,
    };
}

export function discoveryRouter(deps: AppDeps): Router {
    const router = Router();
    const document = discoveryDocument(deps.config.issuer);
    const jwks = { keys: [deps.keys.publicJwk] };

    const publicJson = (body: unknown) => (_req: Request, res: Response) => {
        res.setHeader("Cache-Control", "public, max-age=300");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.json(body);
    };

    router.get("/.well-known/openid-configuration", publicJson(document));
    router.get("/jwks", publicJson(jwks));
    // Wallets look for /apple-touch-icon.png, then /favicon.ico, on the host a
    // login redirects to; all three serve the connector's logo.
    const logo = (_req: Request, res: Response) => {
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.type("image/png").send(LOGO_PNG);
    };
    router.get(["/logo.png", "/apple-touch-icon.png", "/favicon.ico"], logo);
    router.get("/healthz", (_req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.json({ status: "ok" });
    });
    return router;
}
