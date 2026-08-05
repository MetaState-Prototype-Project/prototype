import express, { type Express } from "express";
import type { BridgeContext } from "./context.js";
import { createIconHandler } from "./icon.js";
import { createAuthorizeHandler } from "./oidc/authorize.js";
import { createDiscoveryHandler, createJwksHandler } from "./oidc/discovery.js";
import { createTokenHandler } from "./oidc/token.js";
import { createUserinfoHandler } from "./oidc/userinfo.js";
import { createCallbackHandler, createEventsHandler } from "./w3ds/callback.js";

export function createApp(ctx: BridgeContext): Express {
    const app = express();

    // Behind TLS termination in staging and production, so trust the proxy's
    // headers for logging and for req.protocol.
    app.set("trust proxy", true);
    app.disable("x-powered-by");

    // The token endpoint receives a form; the wallet sends JSON.
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    app.get("/healthz", (_req, res) => {
        res.json({ ok: true });
    });

    // Pointed at by the authentication source's IconURL in GitW3.
    app.get("/icon.svg", createIconHandler());

    app.get("/.well-known/openid-configuration", createDiscoveryHandler(ctx));
    app.get("/jwks", createJwksHandler(ctx));
    app.get("/authorize", createAuthorizeHandler(ctx));
    app.post("/token", createTokenHandler(ctx));
    app.get("/userinfo", createUserinfoHandler(ctx));

    app.post("/w3ds/callback", createCallbackHandler(ctx));
    app.get("/w3ds/events/:session", createEventsHandler(ctx));

    return app;
}
