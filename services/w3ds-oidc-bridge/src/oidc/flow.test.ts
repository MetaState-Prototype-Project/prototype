import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
    CLIENT_ID,
    CLIENT_SECRET,
    CODE_CHALLENGE,
    CODE_VERIFIER,
    type Harness,
    REDIRECT_URI,
    authorizeUrl,
    decodeJwtPayload,
    sessionFromQrPage,
    startHarness,
} from "../harness.test-utils.js";

let bridge: Harness;

beforeAll(async () => {
    bridge = await startHarness();
});

afterAll(async () => {
    await bridge.close();
});

beforeEach(() => {
    bridge.setVerifyResult({ valid: true });
});

/** Drives /authorize and the wallet callback, and returns the minted code. */
async function signIn(
    ename = "@alice",
): Promise<{ code: string; state?: string }> {
    const page = await fetch(authorizeUrl(bridge.url));
    const session = sessionFromQrPage(await page.text());
    const events = bridge.watch(session);

    const response = await fetch(`${bridge.url}/w3ds/callback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            ename,
            session,
            signature: "sig",
            appVersion: "0.4.0",
        }),
    });
    expect(response.status).toBe(200);

    const event = events.events[0];
    if (event?.type !== "redirect") throw new Error("no redirect event");
    const url = new URL(event.url);
    const code = url.searchParams.get("code");
    if (!code) throw new Error("no code in the redirect");
    return { code, state: url.searchParams.get("state") ?? undefined };
}

function tokenRequest(
    fields: Record<string, string>,
    auth: "basic" | "body" = "basic",
) {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        ...fields,
    });
    const headers: Record<string, string> = {
        "content-type": "application/x-www-form-urlencoded",
    };

    if (auth === "basic") {
        const encoded = Buffer.from(
            `${encodeURIComponent(CLIENT_ID)}:${encodeURIComponent(CLIENT_SECRET)}`,
        ).toString("base64");
        headers.authorization = `Basic ${encoded}`;
    } else {
        body.set("client_id", CLIENT_ID);
        body.set("client_secret", CLIENT_SECRET);
    }

    return fetch(`${bridge.url}/token`, { method: "POST", headers, body });
}

describe("discovery", () => {
    it("advertises the issuer exactly as configured", async () => {
        const doc = await (
            await fetch(`${bridge.url}/.well-known/openid-configuration`)
        ).json();
        // goth compares this against every ID token's `iss` byte for byte.
        expect(doc.issuer).toBe(bridge.url);
    });

    it("gives every endpoint as an absolute URL on the issuer's origin", async () => {
        const doc = await (
            await fetch(`${bridge.url}/.well-known/openid-configuration`)
        ).json();
        for (const key of [
            "authorization_endpoint",
            "token_endpoint",
            "userinfo_endpoint",
            "jwks_uri",
        ]) {
            expect(new URL(doc[key]).origin).toBe(new URL(bridge.url).origin);
        }
    });

    it("offers S256 and nothing weaker", async () => {
        const doc = await (
            await fetch(`${bridge.url}/.well-known/openid-configuration`)
        ).json();
        expect(doc.code_challenge_methods_supported).toEqual(["S256"]);
    });

    it("accepts both client authentication styles Go's oauth2 may use", async () => {
        const doc = await (
            await fetch(`${bridge.url}/.well-known/openid-configuration`)
        ).json();
        expect(doc.token_endpoint_auth_methods_supported).toContain(
            "client_secret_basic",
        );
        expect(doc.token_endpoint_auth_methods_supported).toContain(
            "client_secret_post",
        );
    });
});

describe("jwks", () => {
    it("publishes the public key only", async () => {
        const jwks = await (await fetch(`${bridge.url}/jwks`)).json();
        expect(jwks.keys[0].kid).toBe("test-key");
        expect(jwks.keys[0].d).toBeUndefined();
    });
});

describe("cross-origin access", () => {
    // A browser-based wallet posts JSON from its own origin, which triggers a
    // preflight. Express answers OPTIONS with a bare 200 and no CORS headers, so
    // without this the browser blocks the request and reports only "Failed to
    // fetch" — the login hangs with nothing to debug.
    it("answers the preflight on the wallet callback", async () => {
        const response = await fetch(`${bridge.url}/w3ds/callback`, {
            method: "OPTIONS",
            headers: {
                origin: "http://localhost:8080",
                "access-control-request-method": "POST",
                "access-control-request-headers": "content-type",
            },
        });

        expect(response.status).toBeLessThan(300);
        expect(
            response.headers.get("access-control-allow-origin"),
        ).toBeTruthy();
    });

    it("allows the SSE stream cross-origin too", async () => {
        const response = await fetch(`${bridge.url}/w3ds/events/nothing`, {
            headers: { origin: "http://localhost:8080" },
        });
        expect(
            response.headers.get("access-control-allow-origin"),
        ).toBeTruthy();
        await response.body?.cancel();
    });

    it("never allows credentials", async () => {
        // These endpoints carry no cookie. Allowing credentials with a wildcard
        // origin is the combination that turns an open endpoint into a CSRF one.
        const response = await fetch(`${bridge.url}/w3ds/callback`, {
            method: "OPTIONS",
            headers: {
                origin: "http://localhost:8080",
                "access-control-request-method": "POST",
            },
        });
        expect(
            response.headers.get("access-control-allow-credentials"),
        ).toBeNull();
    });

    it("leaves the OIDC half alone", async () => {
        // /token and /userinfo are back-channel calls from Forgejo, and
        // /authorize is a top-level navigation. None of them is ever a
        // cross-origin fetch, so none of them needs to advertise anything.
        const response = await fetch(`${bridge.url}/userinfo`, {
            headers: { origin: "http://evil.example.org" },
        });
        expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });
});

describe("the login button icon", () => {
    it("is served as an SVG the browser will render in an img", async () => {
        // Forgejo drops IconURL straight into <img width=28>, so it has to be an
        // image type, not a download.
        const response = await fetch(`${bridge.url}/icon.svg`);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("image/svg+xml");
        expect(await response.text()).toContain("<svg");
    });
});

describe("authorize", () => {
    describe("before the callback is trusted, nothing redirects", () => {
        it("renders a page for an unknown client", async () => {
            const response = await fetch(
                authorizeUrl(bridge.url, { client_id: "someone-else" }),
                {
                    redirect: "manual",
                },
            );
            expect(response.status).toBe(400);
            expect(response.headers.get("location")).toBeNull();
            expect(await response.text()).toContain("Unknown client");
        });

        it("renders a page for an unregistered redirect_uri", async () => {
            // Bouncing an error to an unverified URI is what makes an open
            // redirector.
            const response = await fetch(
                authorizeUrl(bridge.url, {
                    redirect_uri: "https://evil.example.org/steal",
                }),
                { redirect: "manual" },
            );
            expect(response.status).toBe(400);
            expect(response.headers.get("location")).toBeNull();
        });

        it("rejects a redirect_uri that differs by one character", async () => {
            const response = await fetch(
                authorizeUrl(bridge.url, { redirect_uri: `${REDIRECT_URI}/` }),
                { redirect: "manual" },
            );
            expect(response.status).toBe(400);
            expect(response.headers.get("location")).toBeNull();
        });
    });

    describe("once it is trusted, errors go back to it", () => {
        const errorFrom = async (
            overrides: Record<string, string | undefined>,
        ) => {
            const response = await fetch(authorizeUrl(bridge.url, overrides), {
                redirect: "manual",
            });
            expect(response.status).toBe(302);
            return new URL(response.headers.get("location") ?? "");
        };

        it("refuses a request with no code_challenge", async () => {
            const url = await errorFrom({ code_challenge: undefined });
            expect(url.searchParams.get("error")).toBe("invalid_request");
            expect(url.origin + url.pathname).toBe(REDIRECT_URI);
        });

        it("refuses the plain challenge method", async () => {
            const url = await errorFrom({ code_challenge_method: "plain" });
            expect(url.searchParams.get("error")).toBe("invalid_request");
        });

        it("refuses a response_type other than code", async () => {
            const url = await errorFrom({ response_type: "token" });
            expect(url.searchParams.get("error")).toBe(
                "unsupported_response_type",
            );
        });

        it("preserves state on the way back", async () => {
            const url = await errorFrom({ code_challenge: undefined });
            expect(url.searchParams.get("state")).toBe("the-state");
        });

        describe("silent authentication", () => {
            // Forgejo sends prompt=none on its login page to re-authenticate
            // someone who signed in before, and retries interactively when the
            // provider says login_required. Rendering the QR page instead strands
            // them there, and the login page never appears again after a logout.
            it("refuses prompt=none, because a QR code is interaction", async () => {
                const url = await errorFrom({ prompt: "none" });
                expect(url.searchParams.get("error")).toBe("login_required");
                expect(url.searchParams.get("state")).toBe("the-state");
            });

            it("refuses it inside a space-separated list too", async () => {
                const url = await errorFrom({ prompt: "none consent" });
                expect(url.searchParams.get("error")).toBe("login_required");
            });

            it("serves the QR page for any other prompt value", async () => {
                // `login` asks to re-authenticate, which is all this bridge ever
                // does, so it needs no special handling.
                const response = await fetch(
                    authorizeUrl(bridge.url, { prompt: "login" }),
                );
                expect(response.status).toBe(200);
                expect(await response.text()).toContain("w3ds://auth?redirect=");
            });
        });
    });

    it("serves a self-contained QR page and opens a session", async () => {
        const response = await fetch(authorizeUrl(bridge.url));
        expect(response.status).toBe(200);
        const html = await response.text();

        expect(html).toContain("data:image/png;base64,");
        expect(html).toContain("w3ds://auth?redirect=");
        expect(html).toContain("platform=gitw3");
        // Nothing may be fetched from off-origin: the page must work on an
        // isolated network.
        expect(html).not.toMatch(/src="https?:\/\//);

        const session = sessionFromQrPage(html);
        const stored = bridge.ctx.store.sessions.get(session);
        expect(stored).toMatchObject({
            clientId: CLIENT_ID,
            redirectUri: REDIRECT_URI,
            state: "the-state",
            nonce: "the-nonce",
            codeChallenge: CODE_CHALLENGE,
        });
    });

    it("never caches a page carrying a session id", async () => {
        const response = await fetch(authorizeUrl(bridge.url));
        expect(response.headers.get("cache-control")).toBe("no-store");
    });
});

describe("the wallet callback", () => {
    const callback = (body: Record<string, unknown>) =>
        fetch(`${bridge.url}/w3ds/callback`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });

    async function openSession(): Promise<string> {
        return sessionFromQrPage(
            await (await fetch(authorizeUrl(bridge.url))).text(),
        );
    }

    it("accepts the field as `ename`", async () => {
        const session = await openSession();
        const events = bridge.watch(session);
        const response = await callback({
            ename: "@alice",
            session,
            signature: "sig",
            appVersion: "0.4.0",
        });
        expect(response.status).toBe(200);
        expect(events.events[0]?.type).toBe("redirect");
    });

    it("accepts the field as `w3id`, which is what the protocol docs say", async () => {
        const session = await openSession();
        const events = bridge.watch(session);
        const response = await callback({
            w3id: "@alice",
            session,
            signature: "sig",
            appVersion: "0.4.0",
        });
        expect(response.status).toBe(200);
        expect(events.events[0]?.type).toBe("redirect");
    });

    it("rejects a wallet older than the minimum, and says so on the page", async () => {
        // Without the SSE half, the browser would spin forever in front of a QR
        // code while the wallet showed nothing at all.
        const session = await openSession();
        const events = bridge.watch(session);

        const response = await callback({
            ename: "@alice",
            session,
            signature: "sig",
            appVersion: "0.3.9",
        });

        expect(response.status).toBe(400);
        expect(events.events[0]).toMatchObject({ type: "error" });
        expect((events.events[0] as { message: string }).message).toContain(
            "0.4.0",
        );
    });

    it("rejects a wallet that sends no version at all", async () => {
        const session = await openSession();
        const response = await callback({
            ename: "@alice",
            session,
            signature: "sig",
        });
        expect(response.status).toBe(400);
    });

    it("rejects an unknown session", async () => {
        const events = bridge.watch("00000000-0000-4000-8000-000000000000");
        const response = await callback({
            ename: "@alice",
            session: "00000000-0000-4000-8000-000000000000",
            signature: "sig",
            appVersion: "0.4.0",
        });
        expect(response.status).toBe(400);
        expect(events.events[0]?.type).toBe("error");
    });

    it("rejects a session that has already been used", async () => {
        // The session is consumed on first use, so a replayed signature has
        // nothing to attach to.
        const session = await openSession();
        bridge.watch(session);
        await callback({
            ename: "@alice",
            session,
            signature: "sig",
            appVersion: "0.4.0",
        });

        const replay = await callback({
            ename: "@mallory",
            session,
            signature: "sig",
            appVersion: "0.4.0",
        });
        expect(replay.status).toBe(400);
    });

    it("rejects a signature the Registry does not vouch for", async () => {
        bridge.setVerifyResult({ valid: false, error: "no matching key" });
        const session = await openSession();
        const events = bridge.watch(session);

        const response = await callback({
            ename: "@mallory",
            session,
            signature: "forged",
            appVersion: "0.4.0",
        });

        expect(response.status).toBe(401);
        expect(events.events[0]?.type).toBe("error");
    });

    it("requires a session id before it can report anything", async () => {
        const response = await callback({ ename: "@alice", signature: "sig" });
        expect(response.status).toBe(400);
    });

    it("carries state back to Forgejo untouched", async () => {
        const { state } = await signIn();
        expect(state).toBe("the-state");
    });
});

describe("token", () => {
    it("exchanges a code for an ID token", async () => {
        const { code } = await signIn();
        const response = await tokenRequest({
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: CODE_VERIFIER,
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");

        const payload = await response.json();
        expect(payload.token_type).toBe("Bearer");
        expect(payload.id_token).toBeTruthy();
        expect(payload.access_token).toBeTruthy();
    });

    describe("the ID token satisfies every constraint goth imposes", () => {
        it("carries a numeric exp, an exact iss, and the client as aud", async () => {
            const { code } = await signIn();
            const response = await tokenRequest({
                code,
                redirect_uri: REDIRECT_URI,
                code_verifier: CODE_VERIFIER,
            });
            const claims = decodeJwtPayload((await response.json()).id_token);

            // goth reads exp with an unchecked type assertion: a token without one
            // panics the Forgejo handler rather than failing.
            expect(typeof claims.exp).toBe("number");
            expect(claims.iss).toBe(bridge.url);
            expect(claims.aud).toBe(CLIENT_ID);
            expect(claims.sub).toBe("@alice");
        });

        it("carries the username in both claims and a non-empty email", async () => {
            const { code } = await signIn();
            const claims = decodeJwtPayload(
                (
                    await (
                        await tokenRequest({
                            code,
                            redirect_uri: REDIRECT_URI,
                            code_verifier: CODE_VERIFIER,
                        })
                    ).json()
                ).id_token,
            );

            expect(claims.nickname).toBe("alice");
            expect(claims.preferred_username).toBe("alice");
            expect(claims.email).toBe("alice@w3ds.invalid");
        });

        it("keeps the claim present and empty for a reserved name", async () => {
            // An absent preferred_username panics Forgejo's account-linking page —
            // the very page a reserved name is sent to.
            const { code } = await signIn("@admin");
            const claims = decodeJwtPayload(
                (
                    await (
                        await tokenRequest({
                            code,
                            redirect_uri: REDIRECT_URI,
                            code_verifier: CODE_VERIFIER,
                        })
                    ).json()
                ).id_token,
            );

            expect(Object.hasOwn(claims, "nickname")).toBe(true);
            expect(Object.hasOwn(claims, "preferred_username")).toBe(true);
            expect(claims.nickname).toBe("");
        });

        it("propagates the nonce", async () => {
            const { code } = await signIn();
            const claims = decodeJwtPayload(
                (
                    await (
                        await tokenRequest({
                            code,
                            redirect_uri: REDIRECT_URI,
                            code_verifier: CODE_VERIFIER,
                        })
                    ).json()
                ).id_token,
            );
            expect(claims.nonce).toBe("the-nonce");
        });
    });

    describe("client authentication", () => {
        it("accepts credentials in the Basic header", async () => {
            const { code } = await signIn();
            const response = await tokenRequest(
                {
                    code,
                    redirect_uri: REDIRECT_URI,
                    code_verifier: CODE_VERIFIER,
                },
                "basic",
            );
            expect(response.status).toBe(200);
        });

        it("accepts credentials in the form body", async () => {
            // Go's oauth2 falls back to this style, so both must work.
            const { code } = await signIn();
            const response = await tokenRequest(
                {
                    code,
                    redirect_uri: REDIRECT_URI,
                    code_verifier: CODE_VERIFIER,
                },
                "body",
            );
            expect(response.status).toBe(200);
        });

        it("refuses a wrong secret", async () => {
            const { code } = await signIn();
            const response = await fetch(`${bridge.url}/token`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    authorization: `Basic ${Buffer.from(`${CLIENT_ID}:wrong`).toString("base64")}`,
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: REDIRECT_URI,
                    code_verifier: CODE_VERIFIER,
                }),
            });
            expect(response.status).toBe(401);
            expect((await response.json()).error).toBe("invalid_client");
        });

        it("refuses an unknown client with the same answer as a wrong secret", async () => {
            const response = await fetch(`${bridge.url}/token`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    authorization: `Basic ${Buffer.from("nobody:wrong").toString("base64")}`,
                },
                body: new URLSearchParams({ grant_type: "authorization_code" }),
            });
            expect(response.status).toBe(401);
            expect((await response.json()).error).toBe("invalid_client");
        });
    });

    describe("the code is single use and tightly bound", () => {
        it("refuses a code redeemed twice", async () => {
            const { code } = await signIn();
            const fields = {
                code,
                redirect_uri: REDIRECT_URI,
                code_verifier: CODE_VERIFIER,
            };

            expect((await tokenRequest(fields)).status).toBe(200);

            const replay = await tokenRequest(fields);
            expect(replay.status).toBe(400);
            expect((await replay.json()).error).toBe("invalid_grant");
        });

        it("refuses a code that was never issued", async () => {
            const response = await tokenRequest({
                code: "not-a-code",
                redirect_uri: REDIRECT_URI,
                code_verifier: CODE_VERIFIER,
            });
            expect((await response.json()).error).toBe("invalid_grant");
        });

        it("refuses a code_verifier that is off by one character", async () => {
            const { code } = await signIn();
            const response = await tokenRequest({
                code,
                redirect_uri: REDIRECT_URI,
                code_verifier: `${CODE_VERIFIER.slice(0, -1)}b`,
            });
            expect(response.status).toBe(400);
            expect((await response.json()).error).toBe("invalid_grant");
        });

        it("refuses a request with no code_verifier at all", async () => {
            const { code } = await signIn();
            const response = await tokenRequest({
                code,
                redirect_uri: REDIRECT_URI,
            });
            expect((await response.json()).error).toBe("invalid_request");
        });

        it("refuses a redirect_uri that differs from the authorization request", async () => {
            const { code } = await signIn();
            const response = await tokenRequest({
                code,
                redirect_uri: `${REDIRECT_URI}/`,
                code_verifier: CODE_VERIFIER,
            });
            expect(response.status).toBe(400);
            expect((await response.json()).error).toBe("invalid_grant");
        });
    });

    it("refuses a grant type it does not implement", async () => {
        const response = await fetch(`${bridge.url}/token`, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "client_credentials" }),
        });
        expect((await response.json()).error).toBe("unsupported_grant_type");
    });
});

describe("userinfo", () => {
    async function tokensFor(ename = "@alice") {
        const { code } = await signIn(ename);
        return (
            await tokenRequest({
                code,
                redirect_uri: REDIRECT_URI,
                code_verifier: CODE_VERIFIER,
            })
        ).json();
    }

    it("returns a sub identical to the ID token's", async () => {
        // goth rejects the whole response if these differ.
        const tokens = await tokensFor();
        const response = await fetch(`${bridge.url}/userinfo`, {
            headers: { authorization: `Bearer ${tokens.access_token}` },
        });

        expect(response.status).toBe(200);
        expect((await response.json()).sub).toBe(
            decodeJwtPayload(tokens.id_token).sub,
        );
    });

    it("returns the same claims as the ID token", async () => {
        const tokens = await tokensFor();
        const info = await (
            await fetch(`${bridge.url}/userinfo`, {
                headers: { authorization: `Bearer ${tokens.access_token}` },
            })
        ).json();

        expect(info.preferred_username).toBe("alice");
        expect(info.email).toBe("alice@w3ds.invalid");
    });

    it("refuses a request with no bearer token", async () => {
        expect((await fetch(`${bridge.url}/userinfo`)).status).toBe(401);
    });

    it("refuses a token that is not one of ours", async () => {
        const response = await fetch(`${bridge.url}/userinfo`, {
            headers: { authorization: "Bearer not.a.token" },
        });
        expect(response.status).toBe(401);
        expect(response.headers.get("www-authenticate")).toContain(
            "invalid_token",
        );
    });

    it("refuses an ID token presented as an access token", async () => {
        // Different audience: the ID token is for GitW3, this endpoint is not.
        const tokens = await tokensFor();
        const response = await fetch(`${bridge.url}/userinfo`, {
            headers: { authorization: `Bearer ${tokens.id_token}` },
        });
        expect(response.status).toBe(401);
    });
});
