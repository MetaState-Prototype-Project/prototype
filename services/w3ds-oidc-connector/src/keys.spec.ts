import { createLocalJWKSet, jwtVerify } from "jose";
import { describe, expect, it, vi } from "vitest";
import { generateSigningJwk, loadSigningKeys } from "./keys.js";

describe("loadSigningKeys", () => {
    it("loads a configured key and publishes only its public half", async () => {
        const jwk = await generateSigningJwk();
        const keys = await loadSigningKeys({
            jwk: JSON.stringify(jwk),
            production: true,
        });
        expect(keys.kid).toBe(jwk.kid);
        expect(keys.publicJwk).not.toHaveProperty("d");
        expect(keys.publicJwk).toMatchObject({
            kty: "EC",
            crv: "P-256",
            alg: "ES256",
            use: "sig",
        });
    });

    it("signs tokens that verify against the published key", async () => {
        const keys = await loadSigningKeys({
            jwk: JSON.stringify(await generateSigningJwk()),
            production: false,
        });
        const token = await keys.sign({ sub: "@alice", iss: "https://id" });
        const { payload, protectedHeader } = await jwtVerify(
            token,
            createLocalJWKSet({ keys: [keys.publicJwk] }),
        );
        expect(payload.sub).toBe("@alice");
        expect(protectedHeader).toMatchObject({ alg: "ES256", kid: keys.kid });
    });

    it("generates an ephemeral key in dev, with a warning", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const keys = await loadSigningKeys({ production: false });
        expect(keys.kid).toBeTruthy();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it("refuses to run without a key in production", async () => {
        await expect(loadSigningKeys({ production: true })).rejects.toThrow(
            /required in production/,
        );
    });

    it("rejects a public-only key", async () => {
        const { d: _d, ...pub } = await generateSigningJwk();
        await expect(
            loadSigningKeys({ jwk: JSON.stringify(pub), production: true }),
        ).rejects.toThrow(/private/);
    });
});
