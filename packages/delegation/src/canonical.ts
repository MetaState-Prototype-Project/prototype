/**
 * Deterministic JSON: object keys sorted at every level, `undefined` dropped.
 * Two parties serialising the same record always get the same string.
 */
export function canonicalJson(value: unknown): string {
    return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (value && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value).sort()) {
            const v = (value as Record<string, unknown>)[key];
            if (v !== undefined) out[key] = sortKeys(v);
        }
        return out;
    }
    return value;
}

/**
 * Web Crypto is global in browsers and Node 19+; Node 18 only exposes it as
 * `webcrypto` on the crypto module.
 */
async function subtle(): Promise<SubtleCrypto> {
    if (globalThis.crypto?.subtle) return globalThis.crypto.subtle;
    const { webcrypto } = await import("node:crypto");
    return webcrypto.subtle as SubtleCrypto;
}

/** Hex SHA-256 of a UTF-8 string. */
export async function sha256Hex(input: string): Promise<string> {
    const digest = await (await subtle()).digest(
        "SHA-256",
        new TextEncoder().encode(input),
    );
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
