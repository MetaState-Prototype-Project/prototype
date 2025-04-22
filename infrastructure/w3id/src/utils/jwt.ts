import type { JWTHeader, JWTPayload, Signer } from "../logs/log.types";

/**
 * Encodes a string to base64url format
 */
function base64urlEncode(str: string): string {
    return Buffer.from(str)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

/**
 * Decodes a base64url string
 */
function base64urlDecode(str: string): string {
    return Buffer.from(
        str.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
    ).toString();
}

/**
 * Creates a JWT from the given header and payload
 * @param header - The JWT header
 * @param payload - The JWT payload
 * @returns The unsigned JWT
 */
export function createJWT(header: JWTHeader, payload: JWTPayload): string {
    const encodedHeader = base64urlEncode(JSON.stringify(header));
    const encodedPayload = base64urlEncode(JSON.stringify(payload));
    return `${encodedHeader}.${encodedPayload}`;
}

/**
 * Signs a JWT using the provided signer
 * @param signer - The signer to use
 * @param payload - The JWT payload
 * @param kid - The key ID to use in the JWT header
 * @param header - Optional JWT header (defaults to using the signer's alg and provided kid)
 * @returns The signed JWT
 */
export async function signJWT(
    signer: Signer,
    payload: JWTPayload,
    kid: string,
    header?: JWTHeader,
): Promise<string> {
    const jwtHeader = header || {
        alg: signer.alg,
        typ: "JWT",
        kid,
    };
    const jwt = createJWT(jwtHeader, payload);
    const signature = await signer.sign(jwt);
    return `${jwt}.${signature}`;
}

/**
 * Verifies a JWT signature
 * @param jwt - The JWT to verify
 * @param signature - The signature to verify against
 * @param verifier - The verification function
 * @param pubKey - The public key to verify with
 * @returns True if the signature is valid, false otherwise
 */
export async function verifyJWT(
    jwt: string,
    signature: string,
    verifier: (
        message: string,
        signature: string,
        pubKey: string,
    ) => Promise<boolean>,
    pubKey: string,
): Promise<boolean> {
    return verifier(jwt, signature, pubKey);
}

/**
 * Extracts the header from a JWT
 * @param jwt - The JWT to extract from
 * @returns The JWT header
 */
export function getJWTHeader(jwt: string): JWTHeader {
    const [header] = jwt.split(".");
    return JSON.parse(base64urlDecode(header));
}

/**
 * Extracts the payload from a JWT
 * @param jwt - The JWT to extract from
 * @returns The JWT payload
 */
export function getJWTPayload(jwt: string): JWTPayload {
    const [, payload] = jwt.split(".");
    return JSON.parse(base64urlDecode(payload));
}
