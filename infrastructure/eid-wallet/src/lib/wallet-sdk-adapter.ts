import type { KeyService } from "$lib/global/controllers/key";
import type { CryptoAdapter } from "wallet-sdk";

/**
 * Adapts KeyService to the wallet-sdk CryptoAdapter shape.
 *
 * The wallet-sdk interface takes (keyId, context) because it is a general-purpose
 * SDK; eid-wallet only ever has one key, so we ignore both arguments and delegate
 * to the single-key KeyService.
 */
export function createKeyServiceCryptoAdapter(
    keyService: KeyService,
): CryptoAdapter {
    return {
        async getPublicKey() {
            return keyService.getPublicKey();
        },
        async signPayload(_keyId, _context, payload) {
            return keyService.sign(payload);
        },
        async ensureKey() {
            return keyService.ensureKey();
        },
    };
}
