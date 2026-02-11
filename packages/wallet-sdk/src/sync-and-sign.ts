import type { CryptoAdapter } from "./crypto-adapter.js";

/** Options for syncing the public key to an eVault. */
export interface SyncPublicKeyToEvaultOptions {
    /** Base URL of the eVault (e.g. https://evault.example.com). */
    evaultUrl: string;
    /** eName (W3ID) for the identity. */
    eName: string;
    cryptoAdapter: CryptoAdapter;
    keyId: string;
    /** Key context (e.g. "onboarding"). */
    context: string;
    /** Bearer token for PATCH /public-key. Required by eVault HTTP API. */
    token: string;
}

/**
 * Syncs the adapter's public key to the eVault (PATCH /public-key).
 * Optionally can GET /whois first to verify the eVault; we only do PATCH here.
 */
export async function syncPublicKeyToEvault(
    options: SyncPublicKeyToEvaultOptions,
): Promise<void> {
    const { evaultUrl, eName, cryptoAdapter, keyId, context, token } = options;
    const base = evaultUrl.replace(/\/$/, "");
    const publicKey = await cryptoAdapter.getPublicKey(keyId, context);
    if (!publicKey) {
        throw new Error(`No public key for keyId=${keyId} context=${context}`);
    }

    const res = await fetch(`${base}/public-key`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "X-ENAME": eName,
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ publicKey }),
    });

    if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        const msg = body?.error ?? `${res.status} ${res.statusText}`;
        throw new Error(`Sync public key failed: ${msg}`);
    }
}

/** Options for signing a payload. */
export interface SignPayloadOptions {
    cryptoAdapter: CryptoAdapter;
    keyId: string;
    /** Key context (e.g. "onboarding"). */
    context: string;
    /** Payload string to sign (e.g. session ID or message). */
    payload: string;
}

/**
 * Signs a payload using the adapter. Returns the signature (base64 or multibase per adapter).
 */
export async function signPayload(options: SignPayloadOptions): Promise<string> {
    const { cryptoAdapter, keyId, context, payload } = options;
    return cryptoAdapter.signPayload(keyId, context, payload);
}
