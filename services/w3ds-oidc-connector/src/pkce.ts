/** PKCE (RFC 7636), S256 only. */

import { createHash, timingSafeEqual } from "node:crypto";

/** A base64url SHA-256 digest is always exactly 43 characters. */
export function isValidChallenge(value: unknown): value is string {
    return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function isValidVerifier(value: unknown): value is string {
    return typeof value === "string" && /^[A-Za-z0-9\-._~]{43,128}$/.test(value);
}

export function s256(verifier: string): string {
    return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

export function verifyS256(verifier: unknown, challenge: string): boolean {
    if (!isValidVerifier(verifier)) return false;
    const expected = Buffer.from(challenge);
    const actual = Buffer.from(s256(verifier));
    return (
        expected.length === actual.length && timingSafeEqual(expected, actual)
    );
}
