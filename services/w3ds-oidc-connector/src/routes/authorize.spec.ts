import request from "supertest";
import { describe, expect, it } from "vitest";
import { s256 } from "../pkce.js";
import { ISSUER, KEYCLOAK_REDIRECT, testApp } from "../test-utils.js";

const VERIFIER = "v".repeat(43);

const query = (overrides: Record<string, string | undefined> = {}) => {
    const params: Record<string, string | undefined> = {
        client_id: "keycloak",
        redirect_uri: KEYCLOAK_REDIRECT,
        response_type: "code",
        scope: "openid profile",
        state: "st-1",
        nonce: "n-1",
        code_challenge: s256(VERIFIER),
        code_challenge_method: "S256",
        ...overrides,
    };
    return new URLSearchParams(
        Object.entries(params).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
        ),
    ).toString();
};

function errorRedirect(location: string) {
    const url = new URL(location);
    expect(`${url.origin}${url.pathname}`).toBe(KEYCLOAK_REDIRECT);
    return Object.fromEntries(url.searchParams);
}

describe("GET /authorize", () => {
    it("renders the QR page and binds the session to this browser", async () => {
        const { app, deps } = await testApp();
        const res = await request(app).get(`/authorize?${query()}`);
        expect(res.status).toBe(200);
        expect(res.headers["content-type"]).toMatch(/text\/html/);
        expect(res.headers["content-security-policy"]).toMatch(
            /script-src 'nonce-/,
        );
        expect(res.headers["x-frame-options"]).toBe("DENY");
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(res.text).toContain("<svg");
        expect(res.text).toContain("Log in to Keycloak");

        const link = /href="(w3ds:\/\/auth\?[^"]+)"/.exec(res.text)?.[1];
        expect(link).toBeDefined();
        const params = new URL(link!.replace(/&amp;/g, "&")).searchParams;
        expect(params.get("redirect")).toBe(`${ISSUER}/w3ds/callback`);
        expect(params.get("platform")).toBe("Test Login");
        const sessionId = params.get("session")!;

        const lookup = deps.sessions.lookup(sessionId, deps.now());
        expect(lookup.state).toBe("live");
        if (lookup.state !== "live") return;
        expect(lookup.session).toMatchObject({
            status: "pending",
            purpose: {
                kind: "oidc",
                request: {
                    clientId: "keycloak",
                    redirectUri: KEYCLOAK_REDIRECT,
                    state: "st-1",
                    nonce: "n-1",
                    scope: ["openid", "profile"],
                },
            },
        });

        const cookie = res.headers["set-cookie"][0] as string;
        expect(cookie).toMatch(new RegExp(`^w3ds_oidc_${sessionId}=`));
        expect(cookie).toMatch(/HttpOnly/);
        expect(cookie).toMatch(/SameSite=Lax/);
        const secret = /=([^;]+)/.exec(cookie)![1];
        expect(deps.sessions.isBrowser(lookup.session, secret)).toBe(true);
    });

    it.each([
        ["an unknown client", { client_id: "ghost" }],
        ["a missing client", { client_id: undefined }],
        ["an unregistered redirect URI", { redirect_uri: "https://evil.example/cb" }],
        ["a missing redirect URI", { redirect_uri: undefined }],
    ])("shows an error page, never a redirect, for %s", async (_label, overrides) => {
        const { app } = await testApp();
        const res = await request(app).get(`/authorize?${query(overrides)}`);
        expect(res.status).toBe(400);
        expect(res.headers.location).toBeUndefined();
        expect(res.text).toContain("This login link is not valid");
    });

    it("shows an error page for a repeated redirect_uri", async () => {
        const { app } = await testApp();
        const res = await request(app).get(
            `/authorize?${query()}&redirect_uri=${encodeURIComponent("https://evil.example/cb")}`,
        );
        expect(res.status).toBe(400);
        expect(res.headers.location).toBeUndefined();
    });

    it.each([
        ["no PKCE", { code_challenge: undefined, code_challenge_method: undefined }, "invalid_request"],
        ["plain PKCE", { code_challenge_method: "plain" }, "invalid_request"],
        ["a malformed challenge", { code_challenge: "short" }, "invalid_request"],
        ["response_type=token", { response_type: "token" }, "unsupported_response_type"],
        ["no openid scope", { scope: "profile" }, "invalid_scope"],
        ["response_mode=fragment", { response_mode: "fragment" }, "invalid_request"],
        ["a request object", { request: "eyJ" }, "request_not_supported"],
        ["prompt=none", { prompt: "none" }, "login_required"],
        ["an oversized nonce", { nonce: "n".repeat(513) }, "invalid_request"],
    ])("redirects with an error for %s", async (_label, overrides, error) => {
        const { app } = await testApp();
        const res = await request(app).get(`/authorize?${query(overrides)}`);
        expect(res.status).toBe(302);
        expect(errorRedirect(res.headers.location)).toMatchObject({
            error,
            state: "st-1",
            iss: ISSUER,
        });
    });

    it("rejects any other repeated parameter", async () => {
        const { app } = await testApp();
        const res = await request(app).get(`/authorize?${query()}&scope=openid`);
        expect(res.status).toBe(302);
        expect(errorRedirect(res.headers.location).error).toBe("invalid_request");
    });

    it("drops unknown scopes", async () => {
        const { app, deps } = await testApp();
        const res = await request(app).get(
            `/authorize?${query({ scope: "openid offline_access email" })}`,
        );
        const sessionId = /session=([A-Za-z0-9_-]+)/.exec(res.text)![1];
        const lookup = deps.sessions.lookup(sessionId, deps.now());
        expect(
            lookup.state === "live" &&
                lookup.session.purpose.kind === "oidc" &&
                lookup.session.purpose.request.scope,
        ).toEqual([
            "openid",
            "email",
        ]);
    });

    it("sets a __Host- Secure cookie behind an https issuer", async () => {
        const { testConfig } = await import("../test-utils.js");
        const { app } = await testApp({
            config: testConfig({ issuer: "https://id.example" }),
        });
        const res = await request(app).get(`/authorize?${query()}`);
        const cookie = res.headers["set-cookie"][0] as string;
        expect(cookie).toMatch(/^__Host-w3ds_oidc_/);
        expect(cookie).toMatch(/; Secure/);
    });
});
