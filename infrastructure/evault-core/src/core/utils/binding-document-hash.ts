import * as crypto from "crypto";
import type { BindingDocumentData, BindingDocumentType } from "../types/binding-document";

/**
 * Computes the MD5 hash of a binding document's canonical form (without its signatures array).
 * This is the payload that signers must sign.
 *
 * Canonical form: JSON.stringify({ subject, type, data }) with keys in that fixed order.
 */
export function computeBindingDocumentHash(doc: {
    subject: string;
    type: BindingDocumentType;
    data: BindingDocumentData;
}): string {
    const canonical = JSON.stringify({
        subject: doc.subject,
        type: doc.type,
        data: doc.data,
    });
    return crypto.createHash("md5").update(canonical).digest("hex");
}
