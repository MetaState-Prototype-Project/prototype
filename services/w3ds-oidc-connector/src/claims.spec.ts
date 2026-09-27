import { describe, expect, it } from "vitest";
import { idTokenClaims, sanitizeUsername, userClaims } from "./claims.js";

const IDENTITY = {
    eName: "@E4D1C2B0-5A6F-4C1E-9B1D-3F2A7C8E9D10",
    amr: ["hwk" as const],
    authTime: 1000,
};

describe("sanitizeUsername", () => {
    it.each([
        ["@E4D1C2B0-5A6F-4C1E", "e4d1c2b0-5a6f-4c1e"],
        ["@@a b/c", "a-b-c"],
        ["@--x..", "x"],
        ["@", "w3ds-user"],
        ["@!!!", "w3ds-user"],
        ["@ｆｕｌｌ", "full"],
    ])("%s -> %s", (input, expected) => {
        expect(sanitizeUsername(input)).toBe(expected);
    });

    it("caps the length at 64", () => {
        expect(sanitizeUsername(`@${"a".repeat(100)}`)).toHaveLength(64);
    });
});

describe("claims", () => {
    it("omits email unless the client asks for a synthetic one", () => {
        expect(userClaims(IDENTITY, { syntheticEmail: false })).toEqual({
            sub: IDENTITY.eName,
            preferred_username: "e4d1c2b0-5a6f-4c1e-9b1d-3f2a7c8e9d10",
            amr: ["hwk"],
            auth_time: 1000,
        });
    });

    it("adds an undeliverable, unverified email for clients that need one", () => {
        expect(userClaims(IDENTITY, { syntheticEmail: true })).toMatchObject({
            email: "e4d1c2b0-5a6f-4c1e-9b1d-3f2a7c8e9d10@w3ds.invalid",
            email_verified: false,
        });
    });

    it("builds standard ID token claims", () => {
        const claims = idTokenClaims({
            identity: IDENTITY,
            client: { clientId: "keycloak", syntheticEmail: false },
            issuer: "https://id.example",
            nonce: "n-1",
            nowSeconds: 2000,
            ttlSeconds: 300,
        });
        expect(claims).toMatchObject({
            iss: "https://id.example",
            aud: "keycloak",
            iat: 2000,
            exp: 2300,
            nonce: "n-1",
            sub: IDENTITY.eName,
            auth_time: 1000,
        });
    });

    it("leaves out nonce when none was sent", () => {
        const claims = idTokenClaims({
            identity: IDENTITY,
            client: { clientId: "keycloak", syntheticEmail: false },
            issuer: "https://id.example",
            nowSeconds: 2000,
            ttlSeconds: 300,
        });
        expect(claims).not.toHaveProperty("nonce");
    });
});
