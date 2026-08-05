import cors from "cors";
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

    // The W3DS half is cross-origin by nature, and only this half.
    //
    // A native eID Wallet sends no Origin and is unaffected, but a browser-based
    // one — starting with the Dev Sandbox, which is the documented way to test
    // this flow — posts JSON from its own origin, which triggers a preflight.
    // Without an answer to that preflight the browser blocks the request and
    // reports only "Failed to fetch", so the login hangs with nothing to debug.
    //
    // Any origin is allowed, and credentials are not. These two endpoints carry
    // no cookie and no ambient authority: the callback is authenticated by an
    // ECDSA signature over the session id, checked against the Registry. Refusing
    // an origin would stop no attacker — curl has no origin — and would break
    // every wallet that happens to run in a browser.
    const w3dsCors = cors({ origin: true, credentials: false, maxAge: 600 });
    app.options("/w3ds/callback", w3dsCors);
    app.post("/w3ds/callback", w3dsCors, createCallbackHandler(ctx));
    app.get("/w3ds/events/:session", w3dsCors, createEventsHandler(ctx));

    return app;
}
