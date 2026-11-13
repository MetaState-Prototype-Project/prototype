/**
 * The connector's ID token signing key.
 *
 * In production W3DS_OIDC_SIGNING_KEY_JWK must hold an ES256 private JWK
 * (generate one with `pnpm --filter w3ds-oidc-connector generate-jwk`). In dev
 * an ephemeral key is generated instead, which means every restart rotates the
 * key IdPs validate against.
 */

import {
    type JWK,
    type JWTPayload,
    type KeyLike,
    SignJWT,
    calculateJwkThumbprint,
    exportJWK,
    generateKeyPair,
    importJWK,
} from "jose";
import { log } from "./log.js";

const ALG = "ES256";

export interface SigningKeys {
    kid: string;
    /** The public half, as published at /jwks. */
    publicJwk: JWK;
    sign(claims: JWTPayload): Promise<string>;
}

export async function generateSigningJwk(): Promise<JWK> {
    const { privateKey } = await generateKeyPair(ALG, { extractable: true });
    const jwk = await exportJWK(privateKey);
    const { d: _d, ...pub } = jwk;
    return {
        ...jwk,
        kid: await calculateJwkThumbprint(pub),
        alg: ALG,
        use: "sig",
    };
}

export async function loadSigningKeys(options: {
    jwk?: string;
    production: boolean;
}): Promise<SigningKeys> {
    let jwk: JWK;
    if (options.jwk) {
        try {
            jwk = JSON.parse(options.jwk) as JWK;
        } catch {
            throw new Error("W3DS_OIDC_SIGNING_KEY_JWK is not valid JSON");
        }
        if (jwk.kty !== "EC" || jwk.crv !== "P-256" || !jwk.d) {
            throw new Error(
                "W3DS_OIDC_SIGNING_KEY_JWK must be a private P-256 EC JWK",
            );
        }
    } else if (options.production) {
        throw new Error("W3DS_OIDC_SIGNING_KEY_JWK is required in production");
    } else {
        log.warn(
            "W3DS_OIDC_SIGNING_KEY_JWK not set; using an ephemeral key (dev only). ID tokens will not verify after a restart.",
        );
        jwk = await generateSigningJwk();
    }

    const privateKey = (await importJWK(jwk, ALG)) as KeyLike;
    const {
        d: _d,
        p: _p,
        q: _q,
        dp: _dp,
        dq: _dq,
        qi: _qi,
        key_ops: _ops,
        ...pub
    } = jwk;
    const kid = jwk.kid ?? (await calculateJwkThumbprint(pub));
    const publicJwk: JWK = { ...pub, kid, alg: ALG, use: "sig" };

    return {
        kid,
        publicJwk,
        sign: (claims) =>
            new SignJWT(claims)
                .setProtectedHeader({ alg: ALG, kid, typ: "JWT" })
                .sign(privateKey),
    };
}
