import { createPublicKey } from "node:crypto";
import {
    type JWK,
    type JWTPayload,
    SignJWT,
    exportJWK,
    importPKCS8,
    jwtVerify,
} from "jose";

/**
 * ES256 throughout, for consistency with W3DS: the wallet signs with ECDSA
 * P-256, so the bridge has no reason to introduce a second curve or an RSA key.
 */
const ALG = "ES256";

export interface KeyringOptions {
    /** PKCS#8 PEM. Newlines may be escaped, which is how they survive a .env. */
    signingKey: string;
    /** Stable from day one, so a later rotation is not a breaking change. */
    keyId: string;
    /** Set on every token, byte for byte as goth will compare it. */
    issuer: string;
}

export interface Keyring {
    /**
     * Served at `/jwks`. Decorative for GitW3 — goth never verifies the ID token
     * signature — but the bridge is a conformant provider and the bridge itself
     * uses the key pair to verify its own access tokens at `/userinfo`.
     */
    jwks: { keys: JWK[] };
    sign(payload: JWTPayload, expiresInSeconds: number): Promise<string>;
    verify(token: string, options?: { audience?: string }): Promise<JWTPayload>;
}

export class KeyError extends Error {}

/**
 * A PEM carries newlines, which a .env file does not. Accept the escaped form so
 * the key can be a single line, and tolerate the literal form so a file-mounted
 * secret works too.
 */
function normalisePem(pem: string): string {
    return pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
}

export async function createKeyring(options: KeyringOptions): Promise<Keyring> {
    const pem = normalisePem(options.signingKey.trim());

    let privateKey: Awaited<ReturnType<typeof importPKCS8>>;
    try {
        privateKey = await importPKCS8(pem, ALG);
    } catch (cause) {
        throw new KeyError(
            "W3DS_OIDC_SIGNING_KEY is not a PKCS#8 PEM holding an ES256 (P-256) private key",
            { cause },
        );
    }

    // Derive the public half rather than asking for it separately: two
    // configuration values that must agree are two values that can disagree.
    const publicKey = createPublicKey(privateKey as never);
    const publicJwk = await exportJWK(publicKey);

    return {
        jwks: {
            keys: [{ ...publicJwk, kid: options.keyId, alg: ALG, use: "sig" }],
        },

        async sign(payload, expiresInSeconds) {
            const issuedAt = Math.floor(Date.now() / 1000);
            return (
                new SignJWT(payload)
                    .setProtectedHeader({
                        alg: ALG,
                        kid: options.keyId,
                        typ: "JWT",
                    })
                    .setIssuer(options.issuer)
                    .setIssuedAt(issuedAt)
                    // `exp` is not optional: goth reads it with an unchecked type
                    // assertion and panics on a token without one.
                    .setExpirationTime(issuedAt + expiresInSeconds)
                    .sign(privateKey)
            );
        },

        async verify(token, verifyOptions) {
            const { payload } = await jwtVerify(token, publicKey, {
                algorithms: [ALG],
                issuer: options.issuer,
                audience: verifyOptions?.audience,
            });
            return payload;
        },
    };
}
