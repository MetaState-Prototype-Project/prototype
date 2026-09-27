/**
 * The full login, end to end over a real socket: an IdP's /authorize, the QR
 * page, the browser's event stream, a real wallet signature checked by the
 * real verifier against a mocked Registry and eVault, and the IdP's /token and
 * /userinfo calls.
 */

import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import {
    clearJwksCache,
    verifyEnameSignature,
} from "@metastate-foundation/auth/ename";
import { generateKeyPair, signP256 } from "@metastate-foundation/auth/platform";
import {
    SignJWT,
    createRemoteJWKSet,
    exportJWK,
    generateKeyPair as generateJoseKeyPair,
    jwtVerify,
} from "jose";
import type { KeyLike } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp, createDeps } from "./app.js";
import { generateSigningJwk, loadSigningKeys } from "./keys.js";
import { s256 } from "./pkce.js";
import {
    KEYCLOAK_REDIRECT,
    REGISTRY,
    SECRET,
    readEvents,
    seededRepository,
    testConfig,
} from "./test-utils.js";

const EVAULT = "http://evault.test";
const ENAME = "@e4d1c2b0-5a6f-4c1e-9b1d-3f2a7c8e9d10";
const VERIFIER = "correct-horse-battery-staple-verifier-0123456789";

let registryKey: { privateKey: KeyLike; jwk: Record<string, unknown> };
let wallet: { publicKey: string; privateKey: string };

interface Upstream {
    certificates: () => Promise<string[]>;
    hang: boolean;
}
let upstream: Upstream;

/** Stands in for the Registry and eVault the connector calls out to. */
const upstreamFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (upstream.hang) {
        return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
                reject(init.signal?.reason),
            );
        });
    }
    if (url.origin === REGISTRY && url.pathname === "/resolve") {
        return Response.json({ kind: "evault", ename: ENAME, uri: EVAULT });
    }
    if (url.origin === REGISTRY && url.pathname === "/.well-known/jwks.json") {
        return Response.json({ keys: [registryKey.jwk] });
    }
    if (url.origin === EVAULT && url.pathname === "/whois") {
        return Response.json({
            keyBindingCertificates: await upstream.certificates(),
        });
    }
    return new Response("not found", { status: 404 });
};

const certify = (publicKey: string) =>
    new SignJWT({ ename: ENAME, publicKey })
        .setProtectedHeader({ alg: "ES256", kid: "entropy-key-1" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(registryKey.privateKey);

beforeAll(async () => {
    const { privateKey, publicKey } = await generateJoseKeyPair("ES256");
    registryKey = {
        privateKey,
        jwk: { ...(await exportJWK(publicKey)), kid: "entropy-key-1" },
    };
    wallet = await generateKeyPair();
});

let server: Server | undefined;
let base = "";

beforeEach(async () => {
    clearJwksCache();
    upstream = {
        certificates: async () => [await certify(wallet.publicKey)],
        hang: false,
    };
    // Listen first: the issuer must be the port the socket actually got.
    server = createServer();
    server.listen(0);
    await new Promise((resolve) => server!.once("listening", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    server.on("request", createApp(await buildDeps(base)));
});

afterEach(() => {
    server?.closeAllConnections();
    server?.close();
});

async function buildDeps(issuer: string) {
    const config = testConfig({
        issuer,
        upstreamTimeoutMs: 200,
    });
    const keys = await loadSigningKeys({
        jwk: JSON.stringify(await generateSigningJwk()),
        production: false,
    });
    return createDeps(config, keys, await seededRepository(), {
        verifier: (input) =>
            verifyEnameSignature({
                ...input,
                registryBaseUrl: REGISTRY,
                timeoutMs: config.upstreamTimeoutMs,
                fetch: upstreamFetch,
            }),
    });
}

/** Steps 1-6: the IdP sends the browser to /authorize and gets the QR page. */
async function authorize() {
    const discovery = await (
        await fetch(`${base}/.well-known/openid-configuration`)
    ).json();
    const url = new URL(discovery.authorization_endpoint);
    url.search = new URLSearchParams({
        client_id: "keycloak",
        redirect_uri: KEYCLOAK_REDIRECT,
        response_type: "code",
        scope: "openid profile",
        state: "idp-state",
        nonce: "idp-nonce",
        code_challenge: s256(VERIFIER),
        code_challenge_method: "S256",
    }).toString();
    const res = await fetch(url);
    expect(res.status).toBe(200);
    const html = await res.text();
    const link = new URL(
        /href="(w3ds:\/\/auth\?[^"]+)"/.exec(html)![1].replace(/&amp;/g, "&"),
    );
    const cookie = res.headers.getSetCookie()[0].split(";")[0];
    return {
        discovery,
        cookie,
        session: link.searchParams.get("session")!,
        callback: link.searchParams.get("redirect")!,
    };
}

/** Step 8: the wallet signs S and posts it, as the eID wallet does. */
async function walletPost(
    callback: string,
    session: string,
    signature?: string,
) {
    return fetch(callback, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ename: ENAME,
            session,
            signature: signature ?? (await signP256(wallet.privateKey, session)),
            appVersion: "1.2.0",
        }),
    });
}

/** Step 13: the IdP swaps the code, server to server. */
async function token(
    tokenEndpoint: string,
    code: string,
    overrides: Record<string, string> = {},
) {
    return fetch(tokenEndpoint, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`keycloak:${SECRET}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: KEYCLOAK_REDIRECT,
            code_verifier: VERIFIER,
            ...overrides,
        }),
    });
}

async function approvedRedirect(cookie: string, session: string) {
    const { events } = await readEvents(`${base}/w3ds/events/${session}`, {
        headers: { cookie },
    });
    expect(events.at(-1)?.event).toBe("approved");
    return new URL((events.at(-1)!.data as { redirect: string }).redirect);
}

describe("W3DS OIDC login", () => {
    it("logs a wallet holder in to the IdP", async () => {
        const { discovery, cookie, session, callback } = await authorize();
        expect(callback).toBe(`${base}/w3ds/callback`);

        const stream = readEvents(`${base}/w3ds/events/${session}`, {
            headers: { cookie },
            until: (event) => event !== "pending",
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect((await walletPost(callback, session)).status).toBe(200);
        const { events } = await stream;
        expect(events.map((e) => e.event)).toEqual(["pending", "approved"]);

        const redirect = new URL(
            (events[1].data as { redirect: string }).redirect,
        );
        expect(redirect.searchParams.get("state")).toBe("idp-state");
        expect(redirect.searchParams.get("iss")).toBe(base);

        const res = await token(
            discovery.token_endpoint,
            redirect.searchParams.get("code")!,
        );
        expect(res.status).toBe(200);
        const tokens = await res.json();

        const { payload } = await jwtVerify(
            tokens.id_token,
            createRemoteJWKSet(new URL(discovery.jwks_uri)),
            { issuer: base, audience: "keycloak", algorithms: ["ES256"] },
        );
        expect(payload).toMatchObject({
            sub: ENAME,
            preferred_username: ENAME.slice(1),
            nonce: "idp-nonce",
            amr: ["swk"],
        });

        const userinfo = await fetch(discovery.userinfo_endpoint, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        expect(await userinfo.json()).toMatchObject({ sub: ENAME });
    });

    it("reports a hardware-key signature as amr hwk", async () => {
        const { discovery, cookie, session, callback } = await authorize();
        const { encodeBase58 } = await import(
            "@metastate-foundation/auth/platform"
        );
        const raw = Buffer.from(
            await signP256(wallet.privateKey, session),
            "base64url",
        );
        const multibase = `z${encodeBase58(Uint8Array.from(raw))}`;
        expect((await walletPost(callback, session, multibase)).status).toBe(
            200,
        );
        const redirect = await approvedRedirect(cookie, session);
        const tokens = await (
            await token(
                discovery.token_endpoint,
                redirect.searchParams.get("code")!,
            )
        ).json();
        const { payload } = await jwtVerify(
            tokens.id_token,
            createRemoteJWKSet(new URL(discovery.jwks_uri)),
        );
        expect(payload.amr).toEqual(["hwk"]);
    });

    it("fails closed when the eVault has no certificates, then lets the user retry", async () => {
        const { cookie, session, callback } = await authorize();
        const certificates = upstream.certificates;
        upstream.certificates = async () => [];
        expect((await walletPost(callback, session)).status).toBe(401);

        upstream.certificates = certificates;
        expect((await walletPost(callback, session)).status).toBe(200);
        await approvedRedirect(cookie, session);
    });

    it("fails closed within the timeout when the Registry hangs", async () => {
        const { session, callback } = await authorize();
        upstream.hang = true;
        const started = Date.now();
        expect((await walletPost(callback, session)).status).toBe(401);
        expect(Date.now() - started).toBeLessThan(2000);
    });

    it("rejects a signature by a key the eName does not hold", async () => {
        const { session, callback } = await authorize();
        const stranger = await generateKeyPair();
        const signature = await signP256(stranger.privateKey, session);
        expect((await walletPost(callback, session, signature)).status).toBe(
            401,
        );
    });

    it("rejects a signature over a different session", async () => {
        const first = await authorize();
        const second = await authorize();
        const signature = await signP256(wallet.privateKey, first.session);
        expect(
            (await walletPost(second.callback, second.session, signature))
                .status,
        ).toBe(401);
    });

    it("never hands the code to a browser that did not start the login", async () => {
        const { session, callback } = await authorize();
        const thief = await authorize();
        await walletPost(callback, session);
        const res = await fetch(`${base}/w3ds/events/${session}`, {
            headers: { cookie: thief.cookie },
        });
        expect(res.status).toBe(403);
    });

    it("refuses to exchange a code twice", async () => {
        const { discovery, cookie, session, callback } = await authorize();
        await walletPost(callback, session);
        const code = (await approvedRedirect(cookie, session)).searchParams.get(
            "code",
        )!;
        expect((await token(discovery.token_endpoint, code)).status).toBe(200);
        const replay = await token(discovery.token_endpoint, code);
        expect(replay.status).toBe(400);
        expect((await replay.json()).error).toBe("invalid_grant");
    });

    it("refuses a code with the wrong PKCE verifier", async () => {
        const { discovery, cookie, session, callback } = await authorize();
        await walletPost(callback, session);
        const code = (await approvedRedirect(cookie, session)).searchParams.get(
            "code",
        )!;
        const res = await token(discovery.token_endpoint, code, {
            code_verifier: "x".repeat(43),
        });
        expect((await res.json()).error).toBe("invalid_grant");
    });

    it("completes a mobile deep-link login in the same browser", async () => {
        const { discovery, cookie, session, callback } = await authorize();
        // The wallet builds this from the callback URL, dropping its path.
        const deeplink = new URL("/deeplink-login", callback);
        deeplink.search = new URLSearchParams({
            ename: ENAME,
            session,
            signature: await signP256(wallet.privateKey, session),
            appVersion: "1.2.0",
        }).toString();
        const res = await fetch(deeplink, {
            headers: { cookie },
            redirect: "manual",
        });
        expect(res.status).toBe(303);
        const redirect = new URL(res.headers.get("location")!);
        expect(
            (
                await token(
                    discovery.token_endpoint,
                    redirect.searchParams.get("code")!,
                )
            ).status,
        ).toBe(200);
    });
});
