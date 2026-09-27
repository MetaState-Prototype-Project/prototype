import {
    type VerifyEnameSignatureResult,
    verifyEnameSignature,
} from "@metastate-foundation/auth/ename";
import express, { type Express } from "express";
import { SessionBus } from "./bus.js";
import { ClientRegistry } from "./clients.js";
import type { Config } from "./config.js";
import type { SigningKeys } from "./keys.js";
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
    app.use((_req, res, next) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        next();
    });

    app.use(discoveryRouter(deps));

    app.use((_req, res) => {
        res.status(404).json({ error: "not_found" });
    });
    return app;
}
