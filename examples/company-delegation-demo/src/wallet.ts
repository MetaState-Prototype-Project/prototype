import type { CryptoAdapter } from "wallet-sdk";

const KEY_ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_ALG = { name: "ECDSA", hash: "SHA-256" } as const;

/** A key pair as kept in the demo's state file. */
export type StoredKey = { spki: string; pkcs8: string };

const b64 = (buf: ArrayBuffer) => Buffer.from(buf).toString("base64");
const unb64 = (s: string) => Uint8Array.from(Buffer.from(s, "base64"));

/**
 * A wallet-sdk crypto adapter for Node: P-256 keys like the eID wallet's
 * software keys (public key `z` + hex SPKI, base64 raw signatures), kept in a
 * plain object the demo persists to its state file.
 */
export class NodeWalletAdapter implements CryptoAdapter {
    private pairs = new Map<string, CryptoKeyPair>();

    constructor(private store: Record<string, StoredKey>) {}

    async createKey(keyId: string): Promise<void> {
        const pair = (await crypto.subtle.generateKey(KEY_ALG, true, [
            "sign",
            "verify",
        ])) as CryptoKeyPair;
        const [spki, pkcs8] = await Promise.all([
            crypto.subtle.exportKey("spki", pair.publicKey),
            crypto.subtle.exportKey("pkcs8", pair.privateKey),
        ]);
        this.store[keyId] = { spki: b64(spki), pkcs8: b64(pkcs8) };
        this.pairs.set(keyId, pair);
    }

    async getPublicKey(keyId: string): Promise<string | undefined> {
        const stored = this.store[keyId];
        if (!stored) return undefined;
        return `z${Buffer.from(unb64(stored.spki)).toString("hex")}`;
    }

    async signPayload(keyId: string, _context: string, payload: string) {
        const pair = await this.pair(keyId);
        const sig = await crypto.subtle.sign(
            SIGN_ALG,
            pair.privateKey,
            new TextEncoder().encode(payload),
        );
        return b64(sig);
    }

    async ensureKey(keyId: string) {
        if (this.store[keyId]) return { created: false };
        await this.createKey(keyId);
        return { created: true };
    }

    private async pair(keyId: string): Promise<CryptoKeyPair> {
        const cached = this.pairs.get(keyId);
        if (cached) return cached;
        const stored = this.store[keyId];
        if (!stored) throw new Error(`no key ${keyId}`);
        const pair = {
            privateKey: await crypto.subtle.importKey(
                "pkcs8",
                unb64(stored.pkcs8),
                KEY_ALG,
                true,
                ["sign"],
            ),
            publicKey: await crypto.subtle.importKey(
                "spki",
                unb64(stored.spki),
                KEY_ALG,
                true,
                ["verify"],
            ),
        };
        this.pairs.set(keyId, pair);
        return pair;
    }
}

/**
 * What the eID wallet does with a scanned `w3ds://sign` URI: sign the
 * `session` string as-is and POST the signature to `redirect_uri`.
 */
export async function scanSignRequest(
    uri: string,
    wallet: { eName: string; keyId: string; adapter: NodeWalletAdapter },
): Promise<void> {
    const url = new URL(uri.replace(/^w3ds:\/\//, "https://w3ds.invalid/"));
    if (url.pathname !== "/sign") throw new Error("not a w3ds://sign URI");
    const session = url.searchParams.get("session");
    const redirect = url.searchParams.get("redirect_uri");
    if (!session || !redirect)
        throw new Error("sign URI is missing session or redirect_uri");
    const signature = await wallet.adapter.signPayload(
        wallet.keyId,
        "signing",
        session,
    );
    const res = await fetch(redirect, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            sessionId: session,
            signature,
            w3id: wallet.eName,
            message: session,
        }),
    });
    if (!res.ok) throw new Error(`wallet callback failed: ${res.status}`);
}
