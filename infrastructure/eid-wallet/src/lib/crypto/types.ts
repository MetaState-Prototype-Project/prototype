/**
 * Common interface for key management operations.
 * Every wallet has exactly one key, identified internally by WALLET_KEY_ALIAS.
 * Implementations abstract hardware (Keystore/Secure Enclave) vs software (Web Crypto) storage.
 */
export interface KeyManager {
    exists(): Promise<boolean>;
    generate(): Promise<void>;
    getPublicKey(): Promise<string>;
    signPayload(payload: string): Promise<string>;
    verifySignature(payload: string, signature: string): Promise<boolean>;
    getType(): "hardware" | "software";
}

/**
 * The single key alias used everywhere. Hardware keystore uses this as the alias;
 * software storage uses it as the localStorage slot suffix.
 *
 * Value is "default" for backwards compatibility — existing installs have their
 * hardware keystore entry stored under this alias, and hardware-keystore aliases
 * cannot be renamed from JS. Do NOT change this value.
 */
export const WALLET_KEY_ALIAS = "default";

/**
 * Key pair data structure for software storage.
 */
export interface SoftwareKeyPair {
    privateKey: string;
    publicKey: string;
    createdAt: string;
}

export class KeyManagerError extends Error {
    constructor(
        message: string,
        public readonly code: string,
    ) {
        super(message);
        this.name = "KeyManagerError";
    }
}

export const KeyManagerErrorCodes = {
    KEY_NOT_FOUND: "KEY_NOT_FOUND",
    KEY_GENERATION_FAILED: "KEY_GENERATION_FAILED",
    SIGNING_FAILED: "SIGNING_FAILED",
    VERIFICATION_FAILED: "VERIFICATION_FAILED",
    HARDWARE_UNAVAILABLE: "HARDWARE_UNAVAILABLE",
    STORAGE_ERROR: "STORAGE_ERROR",
} as const;
