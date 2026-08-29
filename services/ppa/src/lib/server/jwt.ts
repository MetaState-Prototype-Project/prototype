import {
    type JWK,
    type KeyLike,
    SignJWT,
    exportJWK,
    generateKeyPair,
    importJWK,
} from "jose";
import { publicUrl, signingJwk } from "./env";

/**
 * The PPA's accreditation signing identity. Every access decision is emitted
 * as a compact ES256 JWS that anyone can verify against the public half served
 * at /.well-known/jwks.json — so a decision stays verifiable even if it is
 * copied out of the eVault it lives in.
 *
 * Boot-time contract (mirrors platforms/enotary/src/lib/server/jwt.ts):
 *  - In production, set PPA_SIGNING_JWK to the full JSON-stringified JWK
 *    (including `d`, the private scalar).
 *  - In dev, leave it unset and an ephemeral keypair is generated on first
 *    use so the app boots. Restarts rotate the key, which invalidates every
 *    previously issued statement — never acceptable outside local dev.
 *
 * Generate a real key with: pnpm --filter ppa generate-jwk
 */

const KID = "ppa-accreditation-key-1";
const ALG = "ES256";

let privateKey: KeyLike | undefined;
let publicJwk: Record<string, unknown> | undefined;

export async function generateInitialJWK(): Promise<JWK> {
    const { privateKey: priv } = await generateKeyPair(ALG, {
        extractable: true,
    });
    const jwk = await exportJWK(priv);
    return { ...jwk, kid: KID, alg: ALG, use: "sig" } as JWK;
}

async function ensureKeys(): Promise<void> {
    if (privateKey && publicJwk) return;

    const raw = signingJwk();
    let jwk: JWK;
    if (raw) {
        jwk = JSON.parse(raw) as JWK;
    } else {
        console.warn(
            "[ppa/jwt] PPA_SIGNING_JWK not set; generating an ephemeral keypair (dev only). Statements signed now will not verify after a restart.",
        );
        jwk = (await generateInitialJWK()) as JWK;
    }
    privateKey = (await importJWK(jwk, ALG)) as KeyLike;
    // Strip the private scalar before stashing for /.well-known/jwks.json.
    const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, ...pub } = jwk;
    publicJwk = { ...pub, kid: jwk.kid ?? KID, alg: ALG, use: "sig" };
}

export interface AccreditationClaims {
    accreditationId: string;
    platformEName: string;
    platformName: string;
    platformVersion: string;
    decision: "granted" | "denied";
    level: string | null;
    domains: string[];
    statement: string;
    reviewedByEName: string;
    submissionEnvelopeId: string;
    supersedes: string | null;
    applicantResponse: string | null;
}

/** Where a verifier fetches the key set that validates our statements. */
export function jwksUri(): string {
    return new URL("/.well-known/jwks.json", publicUrl()).toString();
}

/**
 * Sign one access decision. The version and the granted domains are inside the
 * signature, so a certificate cannot be re-pointed at another release or
 * widened to cover more data after the fact.
 *
 * No `exp`: a decision is retired by a superseding record for the same
 * version, not by expiry.
 */
export async function signAccreditation(
    claims: AccreditationClaims,
): Promise<string> {
    await ensureKeys();
    if (!privateKey) throw new Error("PPA signing key not initialised");

    return new SignJWT({
        decision: claims.decision,
        level: claims.level,
        domains: claims.domains,
        statement: claims.statement,
        reviewedBy: claims.reviewedByEName,
        platformName: claims.platformName,
        platformVersion: claims.platformVersion,
        submissionEnvelopeId: claims.submissionEnvelopeId,
        supersedes: claims.supersedes,
        applicantResponse: claims.applicantResponse,
    })
        .setProtectedHeader({ alg: ALG, kid: KID, typ: "JWT" })
        .setIssuer(publicUrl())
        .setSubject(claims.platformEName)
        .setJti(claims.accreditationId)
        .setIssuedAt()
        .sign(privateKey);
}

/** Returns the JWKS shape `{ keys: [publicJwk] }` for /.well-known/jwks.json. */
export async function getJWKS(): Promise<{ keys: Record<string, unknown>[] }> {
    await ensureKeys();
    if (!publicJwk) throw new Error("PPA signing key not initialised");
    return { keys: [publicJwk] };
}
