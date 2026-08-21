import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { exportPKCS8, generateKeyPair } from "jose";
import { createApp } from "./app.js";
import { createClientRegistry } from "./clients.js";
import type { BridgeConfig } from "./config.js";
import type { BridgeContext, LoginVerification } from "./context.js";
import { createKeyring } from "./keys.js";
import { computeS256Challenge } from "./oidc/token.js";
import { createStore } from "./store.js";
import {
    type EventSink,
    type SessionEvent,
    createSessionStreams,
} from "./w3ds/events.js";

export const CLIENT_ID = "gitw3";
export const CLIENT_SECRET = "a-strong-secret";
export const REDIRECT_URI = "https://git.example.org/user/oauth2/W3DS/callback";
export const CODE_VERIFIER = "a".repeat(64);

/** A sink that records instead of writing, so streams can be asserted on. */
export function recordingSink(): EventSink & {
    events: SessionEvent[];
    ended: boolean;
} {
    const events: SessionEvent[] = [];
    const sink = {
        events,
        ended: false,
        write(chunk: string) {
            const match = chunk.match(/^data: (.*)$/m);
            if (match?.[1]) events.push(JSON.parse(match[1]) as SessionEvent);
        },
        end() {
            sink.ended = true;
        },
        on() {},
    };
    return sink;
}

export interface Harness {
    url: string;
    ctx: BridgeContext;
    /** Swap in per test; defaults to accepting every signature. */
    setVerifyResult(result: LoginVerification): void;
    /** Attaches a recorder to a session so its events can be asserted. */
    watch(session: string): ReturnType<typeof recordingSink>;
    close(): Promise<void>;
}

export async function startHarness(
    configOverrides: Partial<BridgeConfig> = {},
): Promise<Harness> {
    const pair = await generateKeyPair("ES256", { extractable: true });
    const signingKey = await exportPKCS8(pair.privateKey);

    // Filled in once the server has a port: the issuer has to be the address the
    // tests actually call, or goth's byte-for-byte comparison would be untestable.
    const config: BridgeConfig = {
        publicUrl: "",
        port: 0,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        redirectUri: REDIRECT_URI,
        signingKey,
        keyId: "test-key",
        emailDomain: "w3ds.invalid",
        extraReservedUsernames: [],
        minWalletVersion: "0.4.0",
        registryUrl: "https://registry.example.org",
        ...configOverrides,
    };

    let verifyResult: LoginVerification = { valid: true };

    const streams = createSessionStreams({ heartbeatMs: 0 });

    const ctx: BridgeContext = {
        config,
        keyring: await createKeyring({
            signingKey,
            keyId: config.keyId,
            issuer: "",
        }),
        store: createStore(),
        clients: createClientRegistry(config),
        streams,
        async verifyLogin() {
            return verifyResult;
        },
    };

    const app = createApp(ctx);
    const server: Server = await new Promise((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });

    const { port } = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${port}`;

    // Now that the origin is known, rebuild everything that embeds it.
    config.publicUrl = url;
    ctx.keyring = await createKeyring({
        signingKey,
        keyId: config.keyId,
        issuer: url,
    });

    return {
        url,
        ctx,
        setVerifyResult(result) {
            verifyResult = result;
        },
        watch(session) {
            const sink = recordingSink();
            streams.subscribe(session, sink);
            return sink;
        },
        close() {
            streams.closeAll();
            return new Promise((resolve) => server.close(() => resolve()));
        },
    };
}

/** The `code_challenge` a client would send for {@link CODE_VERIFIER}. */
export const CODE_CHALLENGE = computeS256Challenge(CODE_VERIFIER);

export function authorizeUrl(
    base: string,
    overrides: Record<string, string | undefined> = {},
): string {
    const params: Record<string, string | undefined> = {
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: "openid profile email",
        state: "the-state",
        nonce: "the-nonce",
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: "S256",
        ...overrides,
    };

    const url = new URL("/authorize", base);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
    }
    return url.toString();
}

/** Pulls the session id out of the `w3ds://auth` URI embedded in the QR page. */
export function sessionFromQrPage(html: string): string {
    const match = html.match(
        /w3ds:\/\/auth\?redirect=[^&"]+&amp;session=([0-9a-f-]+)/,
    );
    if (!match?.[1]) throw new Error("no session id in the QR page");
    return match[1];
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
    const part = token.split(".")[1];
    if (!part) throw new Error("not a JWT");
    return JSON.parse(Buffer.from(part, "base64url").toString());
}
