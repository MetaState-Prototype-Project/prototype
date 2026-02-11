import type { CryptoAdapter } from "../crypto-adapter";

const TEST_PUBLIC_KEY = "test-public-key-base64-or-multibase";
const KEY_ID = "test-key-1";

/**
 * In-memory test double for CryptoAdapter. Deterministic key and fake signatures.
 * For use in SDK unit/integration tests only; no real crypto.
 */
export class TestCryptoAdapter implements CryptoAdapter {
  private keys = new Map<string, string>();

  async generateKeyPair(): Promise<{ keyId: string; publicKey: string }> {
    this.keys.set(KEY_ID, TEST_PUBLIC_KEY);
    return { keyId: KEY_ID, publicKey: TEST_PUBLIC_KEY };
  }

  async getPublicKey(keyId: string): Promise<string> {
    const pk = this.keys.get(keyId) ?? TEST_PUBLIC_KEY;
    return pk;
  }

  async sign(keyId: string, payload: string): Promise<string> {
    return `sig:${keyId}:${Buffer.from(payload, "utf-8").toString("base64")}`;
  }
}
