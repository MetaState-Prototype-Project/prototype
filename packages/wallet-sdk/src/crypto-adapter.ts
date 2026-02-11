/**
 * Crypto adapter interface (BYOC – bring your own crypto).
 * Implement this to plug your key storage (e.g. KeyService + hardware/software managers) into the SDK.
 */
export interface CryptoAdapter {
    /**
     * Return the public key for the given key id and context, or undefined if not found.
     */
    getPublicKey(keyId: string, context: string): Promise<string | undefined>;

    /**
     * Sign a payload with the given key id and context. Must use the same key as getPublicKey.
     */
    signPayload(
        keyId: string,
        context: string,
        payload: string,
    ): Promise<string>;

    /**
     * Ensure a key exists for the given key id and context (create if needed).
     * Return value can be used to know if a key was created (optional).
     */
    ensureKey(keyId: string, context: string): Promise<{ created: boolean }>;
}
