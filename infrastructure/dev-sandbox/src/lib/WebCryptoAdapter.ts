import type { CryptoAdapter } from "wallet-sdk";

const KEY_ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_ALG = { name: "ECDSA", hash: "SHA-256" } as const;
const KEY_ID_PREFIX = "webcrypto-";

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * In-memory key store (keyId -> CryptoKeyPair). Keys are lost on page reload.
 */
const keyStore = new Map<string, CryptoKeyPair>();

/**
 * Web Crypto adapter: ECDSA P-256 key generation, SPKI base64 public key, SHA-256 signing.
 * Key handles are kept in memory only (not persisted).
 */
export class WebCryptoAdapter implements CryptoAdapter {
  async generateKeyPair(): Promise<{ keyId: string; publicKey: string }> {
    const pair = await crypto.subtle.generateKey(
      { ...KEY_ALG, extractable: true },
      true,
      ["sign", "verify"]
    );
    const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
    const publicKey = bufferToBase64(spki);
    const keyId = `${KEY_ID_PREFIX}${bufferToBase64(crypto.getRandomValues(new Uint8Array(8))).replace(/[/+=]/g, "_")}`;
    keyStore.set(keyId, pair);
    return { keyId, publicKey };
  }

  async getPublicKey(keyId: string): Promise<string> {
    const pair = keyStore.get(keyId);
    if (!pair) throw new Error(`Key not found: ${keyId}`);
    const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
    return bufferToBase64(spki);
  }

  async sign(keyId: string, payload: string): Promise<string> {
    const pair = keyStore.get(keyId);
    if (!pair) throw new Error(`Key not found: ${keyId}`);
    const data = new TextEncoder().encode(payload);
    const sig = await crypto.subtle.sign(
      SIGN_ALG,
      pair.privateKey,
      data
    );
    return bufferToBase64(sig);
  }
}
