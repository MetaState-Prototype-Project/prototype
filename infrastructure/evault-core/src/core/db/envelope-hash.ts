import * as crypto from "crypto";

/**
 * Computes a deterministic SHA-256 hash of envelope content for logging.
 * Used for create/update (id + ontology + payload); for delete, pass only id.
 */
export function computeEnvelopeHash(payload: {
    id?: string;
    ontology: string;
    payload?: Record<string, unknown>;
}): string {
    const obj = {
        id: payload.id ?? "",
        ontology: payload.ontology,
        payload: payload.payload ?? {},
    };
    const canonical = JSON.stringify(obj);
    return crypto.createHash("sha256").update(canonical).digest("hex");
}

/**
 * Computes hash for delete operation (metaEnvelopeId only).
 */
export function computeEnvelopeHashForDelete(metaEnvelopeId: string): string {
    return crypto
        .createHash("sha256")
        .update(JSON.stringify({ id: metaEnvelopeId }))
        .digest("hex");
}
