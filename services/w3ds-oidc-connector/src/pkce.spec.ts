import { describe, expect, it } from "vitest";
import { isValidChallenge, isValidVerifier, s256, verifyS256 } from "./pkce.js";

// RFC 7636 Appendix B.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

describe("pkce", () => {
    it("matches the RFC 7636 test vector", () => {
        expect(s256(VERIFIER)).toBe(CHALLENGE);
        expect(verifyS256(VERIFIER, CHALLENGE)).toBe(true);
    });

    it("rejects the wrong verifier", () => {
        expect(verifyS256(`${VERIFIER.slice(0, -1)}A`, CHALLENGE)).toBe(false);
    });

    it("bounds verifier length and alphabet", () => {
        expect(isValidVerifier("a".repeat(42))).toBe(false);
        expect(isValidVerifier("a".repeat(43))).toBe(true);
        expect(isValidVerifier("a".repeat(128))).toBe(true);
        expect(isValidVerifier("a".repeat(129))).toBe(false);
        expect(isValidVerifier(`${"a".repeat(43)}!`)).toBe(false);
        expect(verifyS256(undefined, CHALLENGE)).toBe(false);
    });

    it("accepts only S256-shaped challenges", () => {
        expect(isValidChallenge(CHALLENGE)).toBe(true);
        expect(isValidChallenge(VERIFIER.slice(0, 42))).toBe(false);
        expect(isValidChallenge(`${CHALLENGE}=`)).toBe(false);
    });
});
