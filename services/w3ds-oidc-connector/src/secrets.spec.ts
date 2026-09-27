import { describe, expect, it } from "vitest";
import { hashClientSecret } from "./clients.js";
import { DUMMY_HASH, isSupportedHash, verifySecret } from "./secrets.js";

describe("secrets", () => {
    it("verifies a generated client secret", async () => {
        const hash = hashClientSecret("s3cret");
        expect(await verifySecret("s3cret", hash)).toBe(true);
        expect(await verifySecret("s3cre", hash)).toBe(false);
    });

    it("rejects malformed hashes", async () => {
        for (const bad of ["", "plain", "sha256:xyz", "scrypt:16384:8:1:a:b", "md5:abc"]) {
            expect(isSupportedHash(bad)).toBe(false);
            expect(await verifySecret("anything", bad)).toBe(false);
        }
    });

    it("never accepts a secret against the dummy hash", async () => {
        expect(isSupportedHash(DUMMY_HASH)).toBe(true);
        expect(await verifySecret("", DUMMY_HASH)).toBe(false);
    });

    it("checks unknown clients with the same fast hash as real ones", () => {
        expect(DUMMY_HASH.split(":")[0]).toBe(hashClientSecret("x").split(":")[0]);
    });
});
