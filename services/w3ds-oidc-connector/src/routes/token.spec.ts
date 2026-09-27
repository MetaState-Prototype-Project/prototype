import { createLocalJWKSet, jwtVerify } from "jose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AppDeps } from "../app.js";
import { s256 } from "../pkce.js";
import type { CodeRecord } from "../store/codes.js";
import {
    ISSUER,
    KEYCLOAK_REDIRECT,
    RAUTHY_REDIRECT,
    SECRET,
    testApp,
} from "../test-utils.js";

const VERIFIER = "v".repeat(43);
const basic = (id: string, secret: string) =>
    `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;

function issueCode(deps: AppDeps, overrides: Partial<CodeRecord> = {}) {
    return deps.codes.issue(
        {
            clientId: "keycloak",
            redirectUri: KEYCLOAK_REDIRECT,
            state: "st",
            nonce: "n-1",
            codeChallenge: s256(VERIFIER),
            scope: ["openid", "profile"],
            identity: { eName: "@alice", amr: ["swk"], authTime: 1000 },
            ...overrides,
        },
        deps.now(),
    );
}

const exchange = (code: string, overrides: Record<string, string> = {}) => ({
    grant_type: "authorization_code",
    code,
    redirect_uri: KEYCLOAK_REDIRECT,
    code_verifier: VERIFIER,
    ...overrides,
});

describe("POST /token", () => {
    it("exchanges a code for a verifiable ID token", async () => {
        const { app, deps } = await testApp();
        const res = await request(app)
            .post("/token")
            .set("Authorization", basic("keycloak", SECRET))
            .type("form")
            .send(exchange(issueCode(deps)));
        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(res.body).toMatchObject({
            token_type: "Bearer",
            expires_in: 300,
            scope: "openid profile",
        });
        const { payload } = await jwtVerify(
            res.body.id_token,
            createLocalJWKSet({ keys: [deps.keys.publicJwk] }),
            { issuer: ISSUER, audience: "keycloak" },
        );
        expect(payload).toMatchObject({
            sub: "@alice",
            preferred_username: "alice",
            amr: ["swk"],
            nonce: "n-1",
            auth_time: 1000,
        });
        expect(payload).not.toHaveProperty("email");

        const userinfo = await request(app)
            .get("/userinfo")
            .set("Authorization", `Bearer ${res.body.access_token}`);
        expect(userinfo.status).toBe(200);
        expect(userinfo.body).toEqual({
            sub: "@alice",
            preferred_username: "alice",
            amr: ["swk"],
            auth_time: 1000,
        });
    });

    it("accepts client_secret_post", async () => {
        const { app, deps } = await testApp();
        const res = await request(app)
            .post("/token")
            .type("form")
            .send({
                ...exchange(issueCode(deps)),
                client_id: "keycloak",
                client_secret: SECRET,
            });
        expect(res.status).toBe(200);
    });

    it("gives synthetic-email clients an email claim", async () => {
        const { app, deps } = await testApp();
        const code = issueCode(deps, {
            clientId: "rauthy",
            redirectUri: RAUTHY_REDIRECT,
        });
        const res = await request(app)
            .post("/token")
            .set("Authorization", basic("rauthy", SECRET))
            .type("form")
            .send(exchange(code, { redirect_uri: RAUTHY_REDIRECT }));
        const { payload } = await jwtVerify(
            res.body.id_token,
            createLocalJWKSet({ keys: [deps.keys.publicJwk] }),
        );
        expect(payload).toMatchObject({
            email: "alice@w3ds.invalid",
            email_verified: false,
        });
    });

    it("rejects a bad client secret with 401 and a challenge", async () => {
        const { app, deps } = await testApp();
        const res = await request(app)
            .post("/token")
            .set("Authorization", basic("keycloak", "wrong"))
            .type("form")
            .send(exchange(issueCode(deps)));
        expect(res.status).toBe(401);
        expect(res.body.error).toBe("invalid_client");
        expect(res.headers["www-authenticate"]).toMatch(/^Basic/);
    });

    it("rejects an unsupported grant type", async () => {
        const { app, deps } = await testApp();
        const res = await request(app)
            .post("/token")
            .set("Authorization", basic("keycloak", SECRET))
            .type("form")
            .send(exchange(issueCode(deps), { grant_type: "refresh_token" }));
        expect(res.status).toBe(400);
        expect(res.body.error).toBe("unsupported_grant_type");
    });

    it("rejects a replayed code and revokes the first access token", async () => {
        const { app, deps } = await testApp();
        const code = issueCode(deps);
        const send = () =>
            request(app)
                .post("/token")
                .set("Authorization", basic("keycloak", SECRET))
                .type("form")
                .send(exchange(code));
        const first = await send();
        expect(first.status).toBe(200);
        const second = await send();
        expect(second.status).toBe(400);
        expect(second.body.error).toBe("invalid_grant");
        const userinfo = await request(app)
            .get("/userinfo")
            .set("Authorization", `Bearer ${first.body.access_token}`);
        expect(userinfo.status).toBe(401);
    });

    it("burns the code on a wrong verifier", async () => {
        const { app, deps } = await testApp();
        const code = issueCode(deps);
        const wrong = await request(app)
            .post("/token")
            .set("Authorization", basic("keycloak", SECRET))
            .type("form")
            .send(exchange(code, { code_verifier: "w".repeat(43) }));
        expect(wrong.body.error).toBe("invalid_grant");
        const right = await request(app)
            .post("/token")
            .set("Authorization", basic("keycloak", SECRET))
            .type("form")
            .send(exchange(code));
        expect(right.body.error).toBe("invalid_grant");
    });

    it.each([
        ["a mismatched redirect_uri", { redirect_uri: "https://kc.example/other" }],
        ["a missing code_verifier", { code_verifier: "" }],
    ])("rejects %s", async (_label, overrides) => {
        const { app, deps } = await testApp();
        const res = await request(app)
            .post("/token")
            .set("Authorization", basic("keycloak", SECRET))
            .type("form")
            .send(exchange(issueCode(deps), overrides));
        expect(res.body.error).toBe("invalid_grant");
    });

    it("rejects a code issued to another client", async () => {
        const { app, deps } = await testApp();
        const res = await request(app)
            .post("/token")
            .set("Authorization", basic("rauthy", SECRET))
            .type("form")
            .send(exchange(issueCode(deps)));
        expect(res.body.error).toBe("invalid_grant");
    });

    it("rejects an expired code", async () => {
        let now = Date.now();
        const { app, deps } = await testApp({ now: () => now });
        const code = issueCode(deps);
        now += 61_000;
        const res = await request(app)
            .post("/token")
            .set("Authorization", basic("keycloak", SECRET))
            .type("form")
            .send(exchange(code));
        expect(res.body.error).toBe("invalid_grant");
    });
});

describe("/userinfo", () => {
    it("rejects a missing or unknown token", async () => {
        const { app } = await testApp();
        for (const header of [undefined, "Bearer nope", "Basic abc"]) {
            const req = request(app).get("/userinfo");
            if (header) req.set("Authorization", header);
            const res = await req;
            expect(res.status).toBe(401);
            expect(res.headers["www-authenticate"]).toBe(
                'Bearer error="invalid_token"',
            );
        }
    });
});
