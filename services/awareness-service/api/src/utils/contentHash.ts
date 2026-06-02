import crypto from "crypto";

/**
 * Deterministic JSON serialisation: object keys are sorted recursively so that
 * two payloads with the same content but different key ordering serialise
 * identically. Array order is preserved (it is semantically significant) and
 * primitives/null pass through unchanged.
 */
export function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value) ?? "null";
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableStringify).join(",")}]`;
    }
    const entries = Object.keys(value as Record<string, unknown>)
        .sort()
        .map(
            (key) =>
                `${JSON.stringify(key)}:${stableStringify(
                    (value as Record<string, unknown>)[key],
                )}`,
        );
    return `{${entries.join(",")}}`;
}

/**
 * SHA-256 of a packet's payload, computed over a stable serialisation so the
 * hash depends only on content, not key ordering. Used to dedupe deliveries by
 * content: identical re-ingests share a hash, a changed payload yields a new one.
 */
export function contentHash(data: unknown): string {
    return crypto
        .createHash("sha256")
        .update(stableStringify(data ?? null))
        .digest("hex");
}
