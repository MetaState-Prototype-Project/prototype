/**
 * Common interface for key management operations
 * Abstracts hardware and software key storage implementations
 */
export interface KeyManager {
    /**
     * Check if a key exists for the given keyId
     */
    exists(keyId: string): Promise<boolean>;

    /**
     * Generate a new key pair for the given keyId
     */
    generate(keyId: string): Promise<string | undefined>;

    /**
     * Get the public key for the given keyId
     */
    getPublicKey(keyId: string): Promise<string | undefined>;

    /**
     * Sign a payload with the given keyId
     */
    signPayload(keyId: string, payload: string): Promise<string>;

    /**
     * Verify a signature with the given keyId and payload
     */
    verifySignature(keyId: string, payload: string, signature: string): Promise<boolean>;

    /**
     * Get the type of key manager (hardware or software)
     */
    getType(): 'hardware' | 'software';
}

/**
 * Configuration for key managers
 */
export interface KeyManagerConfig {
    keyId: string;
    useHardware?: boolean;
    preVerificationMode?: boolean;
}

/**
 * Key pair data structure for software storage
 */
export interface SoftwareKeyPair {
    privateKey: string;
    publicKey: string;
    keyId: string;
    createdAt: string;
}

/**
 * Error types for key management operations
 */
export class KeyManagerError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly keyId?: string
    ) {
        super(message);
        this.name = 'KeyManagerError';
    }
}

export const KeyManagerErrorCodes = {
    KEY_NOT_FOUND: 'KEY_NOT_FOUND',
    KEY_GENERATION_FAILED: 'KEY_GENERATION_FAILED',
    SIGNING_FAILED: 'SIGNING_FAILED',
    VERIFICATION_FAILED: 'VERIFICATION_FAILED',
    HARDWARE_UNAVAILABLE: 'HARDWARE_UNAVAILABLE',
    STORAGE_ERROR: 'STORAGE_ERROR',
} as const;
