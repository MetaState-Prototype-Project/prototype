import type { KeyService } from "$lib/global/controllers/key";
import type { KeyServiceContext } from "$lib/global/controllers/key";
import type { CryptoAdapter } from "wallet-sdk";

/**
 * Adapts KeyService to wallet-sdk CryptoAdapter (BYOC).
 */
export function createKeyServiceCryptoAdapter(
    keyService: KeyService,
): CryptoAdapter {
    return {
        async getPublicKey(keyId: string, context: string) {
            return keyService.getPublicKey(keyId, context as KeyServiceContext);
        },
        async signPayload(keyId: string, context: string, payload: string) {
            return keyService.signPayload(
                keyId,
                context as KeyServiceContext,
                payload,
            );
        },
        async ensureKey(keyId: string, context: string) {
            const { created } = await keyService.ensureKey(
                keyId,
                context as KeyServiceContext,
            );
            return { created };
        },
    };
}
