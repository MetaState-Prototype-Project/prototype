import * as crypto from "crypto";
import type { BindingDocumentData, BindingDocumentType } from "../types/binding-document";

/**
 * Deterministically serializes JSON-like values by recursively sorting object keys.
 */
function stableStringify(value: unknown): string {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(",")}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const entries = keys.map(
        (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`,
    );
    return `{${entries.join(",")}}`;
}

export function getCanonicalBindingDocumentString(doc: {
    subject: string;
    type: BindingDocumentType;
    data: BindingDocumentData;
}): string {
    return stableStringify({
        subject: doc.subject,
        type: doc.type,
        data: doc.data,
    });
}

export function getCanonicalBindingDocumentBytes(doc: {
    subject: string;
    type: BindingDocumentType;
    data: BindingDocumentData;
}): Uint8Array {
    return Buffer.from(getCanonicalBindingDocumentString(doc), "utf8");
}

/**
 * Computes the SHA-256 hash of a binding document's canonical form
 * (without its signatures array).
 */
export function computeBindingDocumentHash(doc: {
    subject: string;
    type: BindingDocumentType;
    data: BindingDocumentData;
}): string {
    const canonicalBytes = getCanonicalBindingDocumentBytes(doc);
    return crypto.createHash("sha256").update(canonicalBytes).digest("hex");
}
