import { generateKeyPair, exportJWK } from "jose";
import type { KeyLike, JWK } from "jose";

let testKeyPair: { privateKey: KeyLike; publicKey: KeyLike; publicJWK: JWK } | null = null;

/**
 * Gets or generates a shared test key pair for JWT signing/verification in tests
 * This ensures the same key pair is used across all test utilities
 */
export async function getSharedTestKeyPair() {
    if (!testKeyPair) {
        // Generate a proper EC key pair for JWT signing
        const { publicKey, privateKey } = await generateKeyPair("ES256", {
            extractable: true,
        });
        const publicJWK = await exportJWK(publicKey);
        publicJWK.kid = "entropy-key-1";
        publicJWK.alg = "ES256";
        publicJWK.use = "sig";
        testKeyPair = { privateKey, publicKey, publicJWK };
    }
    return testKeyPair;
}

/**
 * Gets the public JWK for the shared test key pair (for JWKS endpoints)
 */
export async function getSharedTestPublicJWK() {
    const { publicJWK } = await getSharedTestKeyPair();
    // Remove private key components (d) if present
    const { d, ...publicKeyOnly } = publicJWK;
    return publicKeyOnly;
}

