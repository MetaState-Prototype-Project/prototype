import * as argon2 from "argon2";

/**
 * Normalises an answer to the canonical form used for hashing and verification:
 * NFKC → trim → collapse internal whitespace → lowercase → strip punctuation.
 * Unicode letters (accents, non-Latin scripts) are preserved.
 */
export function normalizeAnswer(raw: string): string {
    if (typeof raw !== "string") return "";
    return raw
        .normalize("NFKC")
        .trim()
        .replace(/\s+/gu, " ")
        .toLowerCase()
        .replace(/[^\p{L}\p{N} ]/gu, "")
        .trim();
}

/** Normalises and hashes the answer with Argon2id. Throws on empty input. */
export async function hashAnswer(raw: string): Promise<string> {
    const normalised = normalizeAnswer(raw);
    if (normalised.length === 0) {
        throw new Error("Cannot hash an empty answer after normalisation");
    }
    return argon2.hash(normalised, { type: argon2.argon2id });
}

/**
 * Verifies a candidate against a stored Argon2id hash. The candidate is run
 * through the same normalisation pipeline. Returns false (rather than
 * throwing) on a malformed stored hash — the caller can't fix that anyway.
 */
export async function verifyAnswer(
    storedHash: string,
    candidate: string,
): Promise<boolean> {
    const normalised = normalizeAnswer(candidate);
    if (normalised.length === 0) return false;
    try {
        return await argon2.verify(storedHash, normalised);
    } catch {
        return false;
    }
}
