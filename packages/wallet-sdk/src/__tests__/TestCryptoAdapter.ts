import type { CryptoAdapter } from "../crypto-adapter.js";

const TEST_PUBLIC_KEY = "test-public-key-base64-or-multibase";
const KEY_ID = "test-key-1";

function toBase64(s: string): string {
	return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

/**
 * In-memory test double for CryptoAdapter. Deterministic key and fake signatures.
 * For use in SDK unit/integration tests only; no real crypto.
 */
export class TestCryptoAdapter implements CryptoAdapter {
	private keys = new Map<string, string>();

	async getPublicKey(keyId: string, _context: string): Promise<string | undefined> {
		const pk = this.keys.get(keyId) ?? TEST_PUBLIC_KEY;
		return pk;
	}

	async signPayload(keyId: string, _context: string, payload: string): Promise<string> {
		return `sig:${keyId}:${toBase64(payload)}`;
	}

	async ensureKey(keyId: string, _context: string): Promise<{ created: boolean }> {
		if (!this.keys.has(keyId)) {
			this.keys.set(keyId, TEST_PUBLIC_KEY);
			return { created: true };
		}
		return { created: false };
	}
}
