import {
    type VerifyEnameSignatureResult,
    verifyEnameSignature,
} from "@metastate-foundation/auth/ename";
import express, {
    type Express,
    type NextFunction,
    type Request,
    type Response,
} from "express";
import { SessionBus } from "./bus.js";
import { ClientRegistry } from "./clients.js";
import type { Config } from "./config.js";
import type { SigningKeys } from "./keys.js";
import { log } from "./log.js";
import { authorizeRouter } from "./routes/authorize.js";
import { tokenRouter } from "./routes/token.js";
import { userinfoRouter } from "./routes/userinfo.js";
import { w3dsRouter } from "./routes/w3ds.js";
import { discoveryRouter } from "./routes/discovery.js";
import { CodeStore } from "./store/codes.js";
import { SessionStore } from "./store/sessions.js";
import { AccessTokenStore } from "./store/tokens.js";

export type WalletVerifier = (input: {
    eName: string;
    payload: string;
    signature: string;
}) => Promise<VerifyEnameSignatureResult>;

export interface AppDeps {
    config: Config;
    keys: SigningKeys;
    clients: ClientRegistry;
    sessions: SessionStore;
    codes: CodeStore;
    tokens: AccessTokenStore;
    bus: SessionBus;
    verifier: WalletVerifier;
    /** Milliseconds since the epoch; injectable for tests. */
    now: () => number;
}

export function createDeps(
    config: Config,
    keys: SigningKeys,
    overrides: Partial<AppDeps> = {},
): AppDeps {
    return {
        config,
        keys,
        clients: new ClientRegistry(config.clients),
        sessions: new SessionStore(config.sessionTtlSeconds * 1000),
        codes: new CodeStore(
            config.codeTtlSeconds * 1000,
            config.tokenTtlSeconds * 1000,
        ),
        tokens: new AccessTokenStore(config.tokenTtlSeconds * 1000),
        bus: new SessionBus(),
        verifier: (input) =>
            verifyEnameSignature({
                ...input,
                registryBaseUrl: config.registryUrl,
                timeoutMs: config.upstreamTimeoutMs,
                jwksCacheMs: config.jwksCacheSeconds * 1000,
            }),
        now: Date.now,
        ...overrides,
    };
}

export function createApp(deps: AppDeps): Express {
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", deps.config.trustProxy);
    // Repeated parameters arrive as arrays, never as nested objects.
    app.set("query parser", "simple");
    app.use((_req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        next();
    });

    app.use(discoveryRouter(deps));
    app.use(authorizeRouter(deps));
    app.use(w3dsRouter(deps));
    app.use(tokenRouter(deps));
    app.use(userinfoRouter(deps));

    app.use((_req, res) => {
        res.status(404).json({ error: "not_found" });
    });
    app.use(
        (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
            // Malformed bodies from express.json / urlencoded.
            const status = (error as { status?: unknown }).status;
            if (typeof status === "number" && status >= 400 && status < 500) {
                if (!res.headersSent) {
                    res.status(status).json({ error: "invalid_request" });
                }
                return;
            }
            log.error(
                "unhandled error:",
                error instanceof Error ? error.message : error,
            );
            if (!res.headersSent) {
                res.status(500).json({ error: "server_error" });
            }
        },
    );
    return app;
}
