import type { CryptoAdapter } from "wallet-sdk";

const KEY_ALG = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_ALG = { name: "ECDSA", hash: "SHA-256" } as const;
const KEY_ID_PREFIX = "webcrypto-";
const STORAGE_KEY = "dev-sandbox-keys";

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Same as eID SoftwareKeyManager: multibase "z" + hex(bytes) for key-binding certs. */
function bufferToMultibaseHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `z${hex}`;
}

type StoredKey = { publicKeyBase64: string; privateKeyPkcs8Base64: string };

function readStoredKeys(): Record<string, StoredKey> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredKey>;
  } catch {
    return {};
  }
}

function writeStoredKeys(keys: Record<string, StoredKey>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

/**
 * In-memory key store (keyId -> CryptoKeyPair). Hydrated from localStorage.
 */
const keyStore = new Map<string, CryptoKeyPair>();

/**
 * Web Crypto adapter that persists key material to localStorage and can hydrate on load.
 * ECDSA P-256, SPKI base64 public key, SHA-256 signing.
 */
export class PersistingWebCryptoAdapter implements CryptoAdapter {
  /**
   * Load all stored keys from localStorage and import them into the in-memory key store.
   * Call once on app init after identities are known (or call with no args to load all stored keyIds).
   */
  async hydrateFromStorage(keyIds?: string[]): Promise<void> {
    const stored = readStoredKeys();
    const toLoad = keyIds ?? Object.keys(stored);
    for (const keyId of toLoad) {
      if (keyStore.has(keyId)) continue;
      const entry = stored[keyId];
      if (!entry?.privateKeyPkcs8Base64) continue;
      try {
        const privateKey = await crypto.subtle.importKey(
          "pkcs8",
          base64ToBuffer(entry.privateKeyPkcs8Base64),
          KEY_ALG,
          true,
          ["sign"]
        );
        const publicKey = await crypto.subtle.importKey(
          "spki",
          base64ToBuffer(entry.publicKeyBase64),
          KEY_ALG,
          true,
          ["verify"]
        );
        keyStore.set(keyId, { privateKey, publicKey });
      } catch {
        // Skip invalid or corrupted entries
      }
    }
  }

  async generateKeyPair(): Promise<{ keyId: string; publicKey: string }> {
    const pair = await crypto.subtle.generateKey(
      { ...KEY_ALG, extractable: true },
      true,
      ["sign", "verify"]
    );
    const [spki, pkcs8] = await Promise.all([
      crypto.subtle.exportKey("spki", pair.publicKey),
      crypto.subtle.exportKey("pkcs8", pair.privateKey),
    ]);
    const publicKeyBase64 = bufferToBase64(spki);
    const privateKeyPkcs8Base64 = bufferToBase64(pkcs8);
    const keyId = `${KEY_ID_PREFIX}${bufferToBase64(crypto.getRandomValues(new Uint8Array(8))).replace(/[/+=]/g, "_")}`;

    keyStore.set(keyId, pair);
    const stored = readStoredKeys();
    stored[keyId] = { publicKeyBase64, privateKeyPkcs8Base64 };
    writeStoredKeys(stored);

    // eID wallet format: z + hex(SPKI) so key-binding certs and signature-validator accept it
    return { keyId, publicKey: bufferToMultibaseHex(spki) };
  }

  private async ensureKey(keyId: string): Promise<CryptoKeyPair> {
    let pair = keyStore.get(keyId);
    if (pair) return pair;
    const stored = readStoredKeys()[keyId];
    if (!stored?.privateKeyPkcs8Base64) throw new Error(`Key not found: ${keyId}`);
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      base64ToBuffer(stored.privateKeyPkcs8Base64),
      KEY_ALG,
      true,
      ["sign"]
    );
    const publicKey = await crypto.subtle.importKey(
      "spki",
      base64ToBuffer(stored.publicKeyBase64),
      KEY_ALG,
      true,
      ["verify"]
    );
    pair = { privateKey, publicKey };
    keyStore.set(keyId, pair);
    return pair;
  }

  async getPublicKey(keyId: string): Promise<string> {
    const pair = await this.ensureKey(keyId);
    const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
    return bufferToMultibaseHex(spki);
  }

  async sign(keyId: string, payload: string): Promise<string> {
    const pair = await this.ensureKey(keyId);
    const data = new TextEncoder().encode(payload);
    const sig = await crypto.subtle.sign(SIGN_ALG, pair.privateKey, data);
    return bufferToBase64(sig);
  }
}
