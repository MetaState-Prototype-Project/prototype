import {
    type JWK,
    type KeyLike,
    SignJWT,
    exportJWK,
    generateKeyPair,
    importJWK,
} from "jose";
import { env } from "$env/dynamic/private";

/**
 * Per-notary ES256 signing identity. Mirrors the registry's jwt.ts pattern.
 * Used to sign recovery-issuance JWTs that the wallet later verifies against
 * the public half exposed at /.well-known/jwks.json.
 *
 * Boot-time contract:
 *  - In production, set ENOTARY_JWK to the full JSON-stringified JWK (with
 *    `d` — the private scalar).
 *  - In dev, leave it unset and we'll generate an ephemeral keypair on first
 *    request so the app boots; restarts rotate the key, which is fine for
 *    short-lived recovery codes.
 *
 * Use `generateInitialJWK()` once locally to mint a JWK for a real env.
 */

let privateKey: KeyLike | undefined;
let publicJwk: Record<string, unknown> | undefined;
const KID = "enotary-recovery-key-1";
const ALG = "ES256";

export async function generateInitialJWK(): Promise<JWK> {
    const { privateKey: priv } = await generateKeyPair(ALG, {
        extractable: true,
    });
    const jwk = await exportJWK(priv);
    return { ...jwk, kid: KID, alg: ALG, use: "sig" } as JWK;
}

async function ensureKeys(): Promise<void> {
    if (privateKey && publicJwk) return;

    const raw = env.ENOTARY_JWK;
    let jwk: JWK;
    if (raw) {
        jwk = JSON.parse(raw) as JWK;
    } else {
        // Dev fallback — ephemeral per-process key. Logged once so devs know
        // the QRs they generate now won't be verifiable across a restart.
        console.warn(
            "[enotary/jwt] ENOTARY_JWK not set; generating an ephemeral keypair (dev only).",
        );
        jwk = (await generateInitialJWK()) as JWK;
    }
    privateKey = (await importJWK(jwk, ALG)) as KeyLike;
    // Strip the private scalar before stashing for /.well-known/jwks.json.
    const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, ...pub } = jwk;
    publicJwk = { ...pub, kid: jwk.kid ?? KID, alg: ALG, use: "sig" };
}

export interface RecoveryTokenPayload {
    sessionId: string;
    targetEName: string;
    notaryEName: string;
    claim: string;
}

/** Sign a recovery JWT. Expiry baked in at the call site so issue.ts owns TTL. */
export async function signRecoveryToken(
    payload: RecoveryTokenPayload,
    expiresInSeconds: number,
): Promise<string> {
    await ensureKeys();
    if (!privateKey) throw new Error("Recovery signing key not initialised");
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: ALG, kid: KID })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
        .sign(privateKey);
}

/** Returns the JWKS shape `{ keys: [publicJwk] }` for /.well-known/jwks.json. */
export async function getJWKS(): Promise<{ keys: Record<string, unknown>[] }> {
    await ensureKeys();
    if (!publicJwk) throw new Error("Recovery signing key not initialised");
    return { keys: [publicJwk] };
}
