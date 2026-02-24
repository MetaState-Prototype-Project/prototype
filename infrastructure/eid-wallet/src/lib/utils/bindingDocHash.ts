/**
 * Client-side mirror of the backend's binding-document-hash utility.
 * Produces SHA-256(stableStringify({subject, type, data})) as a hex string —
 * the exact value the eVault backend expects for counterparty signatures.
 */

function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${(value as unknown[]).map((item) => stableStringify(item)).join(",")}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const entries = keys.map(
        (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`,
    );
    return `{${entries.join(",")}}`;
}

export function getCanonicalBindingDocString(doc: {
    subject: string;
    type: string;
    data: Record<string, unknown>;
}): string {
    return stableStringify({
        subject: doc.subject,
        type: doc.type,
        data: doc.data,
    });
}

export async function computeBindingDocHash(doc: {
    subject: string;
    type: string;
    data: Record<string, unknown>;
}): Promise<string> {
    const canonical = getCanonicalBindingDocString(doc);
    const encoded = new TextEncoder().encode(canonical);
    const hashBuf = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
