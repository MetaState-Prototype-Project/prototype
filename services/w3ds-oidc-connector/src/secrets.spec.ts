import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
    DUMMY_HASH,
    hashSecret,
    isSupportedHash,
    verifySecret,
} from "./secrets.js";

describe("secrets", () => {
    it("round-trips an scrypt hash", async () => {
        const hash = await hashSecret("correct horse");
        expect(hash).toMatch(/^scrypt:16384:8:1:/);
        expect(await verifySecret("correct horse", hash)).toBe(true);
        expect(await verifySecret("wrong horse", hash)).toBe(false);
    });

    it("salts every hash", async () => {
        expect(await hashSecret("same")).not.toBe(await hashSecret("same"));
    });

    it("verifies a sha256 hash", async () => {
        const digest = createHash("sha256").update("s3cret").digest("hex");
        expect(await verifySecret("s3cret", `sha256:${digest}`)).toBe(true);
        expect(await verifySecret("other", `sha256:${digest}`)).toBe(false);
    });

    it("rejects malformed hashes", async () => {
        for (const bad of [
            "",
            "plain",
            "sha256:xyz",
            "scrypt:1000:8:1:c2FsdHNhbHQ:a2V5a2V5a2V5a2V5a2V5",
            "scrypt:16384:8:1:c2FsdA",
            "md5:abc",
        ]) {
            expect(isSupportedHash(bad)).toBe(false);
            expect(await verifySecret("anything", bad)).toBe(false);
        }
    });

    it("never accepts a secret against the dummy hash", async () => {
        expect(isSupportedHash(DUMMY_HASH)).toBe(true);
        expect(await verifySecret("", DUMMY_HASH)).toBe(false);
    });
});
