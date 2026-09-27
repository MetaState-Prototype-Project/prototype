import request from "supertest";
import { describe, expect, it } from "vitest";
import { ISSUER, testApp } from "../test-utils.js";

describe("discovery", () => {
    it("serves the OpenID configuration", async () => {
        const { app } = await testApp();
        const res = await request(app).get("/.well-known/openid-configuration");
        expect(res.status).toBe(200);
        expect(res.headers["access-control-allow-origin"]).toBe("*");
        expect(res.body).toMatchObject({
            issuer: ISSUER,
            authorization_endpoint: `${ISSUER}/authorize`,
            token_endpoint: `${ISSUER}/token`,
            userinfo_endpoint: `${ISSUER}/userinfo`,
            jwks_uri: `${ISSUER}/jwks`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code"],
            code_challenge_methods_supported: ["S256"],
            id_token_signing_alg_values_supported: ["ES256"],
            authorization_response_iss_parameter_supported: true,
        });
    });

    it("serves the public signing key only", async () => {
        const { app, deps } = await testApp();
        const res = await request(app).get("/jwks");
        expect(res.status).toBe(200);
        expect(res.body.keys).toHaveLength(1);
        expect(res.body.keys[0]).toMatchObject({
            kid: deps.keys.kid,
            alg: "ES256",
            use: "sig",
        });
        expect(res.body.keys[0]).not.toHaveProperty("d");
    });

    it("answers health checks", async () => {
        const { app } = await testApp();
        const res = await request(app).get("/healthz");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok" });
    });

    it("returns 404 JSON for unknown paths", async () => {
        const { app } = await testApp();
        const res = await request(app).get("/nope");
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: "not_found" });
    });
});
