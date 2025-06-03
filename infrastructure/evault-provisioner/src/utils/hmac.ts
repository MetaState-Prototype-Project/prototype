import { createHmac } from "crypto";

/**
 * Generates an HMAC SHA-256 signature for a JSON-serializable object using the provided secret key.
 *
 * @param body - The object to be signed.
 * @param secret - The secret key used for HMAC generation.
 * @returns The hexadecimal string representation of the HMAC signature.
 */
export function createHmacSignature(body: Record<string, any>, secret: string) {
    return createHmac("sha256", secret)
        .update(JSON.stringify(body))
        .digest("hex");
}

/**
 * Verifies that a provided HMAC signature matches the expected signature for a given object and secret key.
 *
 * @param body - The object whose signature is to be verified.
 * @param signature - The HMAC signature to compare against.
 * @param secret - The secret key used to generate the expected signature.
 * @returns `true` if the signature is valid; otherwise, `false`.
 */
export function verifyHmacSignature(
    body: Record<string, any>,
    signature: string,
    secret: string,
) {
    const expectedSignature = createHmacSignature(body, secret);
    return expectedSignature === signature;
}
