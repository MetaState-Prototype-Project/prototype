import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyForgejoSignature } from "./signature.js";

const secret = "test-secret";
const body = Buffer.from(JSON.stringify({ ref: "refs/heads/main" }));
const validSignature = createHmac("sha256", secret).update(body).digest("hex");

describe("verifyForgejoSignature", () => {
    it("accepts a valid, unprefixed signature", () => {
        expect(verifyForgejoSignature(body, secret, validSignature)).toBe(true);
    });

    it("rejects a signature computed over a different body (one byte flipped)", () => {
        const tamperedBody = Buffer.from(
            JSON.stringify({ ref: "refs/heads/mein" }),
        );
        expect(
            verifyForgejoSignature(tamperedBody, secret, validSignature),
        ).toBe(false);
    });

    it("rejects a sha256=-prefixed value - the GitHub-boilerplate trap", () => {
        // Regression guard: adapting GitHub-webhook-verification code that
        // strips a "sha256=" prefix, then pointing it at X-Forgejo-Signature
        // (which carries no prefix), must not accidentally validate.
        expect(
            verifyForgejoSignature(body, secret, `sha256=${validSignature}`),
        ).toBe(false);
    });

    it("rejects a missing header without throwing", () => {
        expect(verifyForgejoSignature(body, secret, undefined)).toBe(false);
    });

    it("rejects the wrong secret", () => {
        expect(
            verifyForgejoSignature(body, "wrong-secret", validSignature),
        ).toBe(false);
    });

    it("rejects non-hex garbage without throwing", () => {
        expect(verifyForgejoSignature(body, secret, "not-hex-at-all!!")).toBe(
            false,
        );
    });
});
