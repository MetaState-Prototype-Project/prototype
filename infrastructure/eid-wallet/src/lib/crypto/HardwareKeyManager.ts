import {
    exists as hwExists,
    generate as hwGenerate,
    getPublicKey as hwGetPublicKey,
    signPayload as hwSignPayload,
    verifySignature as hwVerifySignature,
} from "@auvo/tauri-plugin-crypto-hw-api";
import type { KeyManager } from "./types";
import {
    KeyManagerError,
    KeyManagerErrorCodes,
    WALLET_KEY_ALIAS,
} from "./types";

/**
 * Hardware-backed key manager. Uses Android Keystore / iOS Secure Enclave / TPM
 * via the Tauri crypto-hw plugin. Errors propagate to the caller; there is no
 * silent fallback to software at this layer.
 */
export class HardwareKeyManager implements KeyManager {
    getType(): "hardware" | "software" {
        return "hardware";
    }

    async exists(): Promise<boolean> {
        try {
            return await hwExists(WALLET_KEY_ALIAS);
        } catch (error) {
            throw new KeyManagerError(
                `Hardware key exists check failed: ${stringifyError(error)}`,
                KeyManagerErrorCodes.HARDWARE_UNAVAILABLE,
            );
        }
    }

    async generate(): Promise<void> {
        try {
            await hwGenerate(WALLET_KEY_ALIAS);
        } catch (error) {
            throw new KeyManagerError(
                `Hardware key generation failed: ${stringifyError(error)}`,
                KeyManagerErrorCodes.KEY_GENERATION_FAILED,
            );
        }
    }

    async getPublicKey(): Promise<string> {
        try {
            const pk = await hwGetPublicKey(WALLET_KEY_ALIAS);
            if (!pk) {
                throw new KeyManagerError(
                    "Hardware key not found",
                    KeyManagerErrorCodes.KEY_NOT_FOUND,
                );
            }
            return pk;
        } catch (error) {
            if (error instanceof KeyManagerError) throw error;
            throw new KeyManagerError(
                `Hardware public key retrieval failed: ${stringifyError(error)}`,
                KeyManagerErrorCodes.KEY_NOT_FOUND,
            );
        }
    }

    async signPayload(payload: string): Promise<string> {
        try {
            return await hwSignPayload(WALLET_KEY_ALIAS, payload);
        } catch (error) {
            throw new KeyManagerError(
                `Hardware signing failed: ${stringifyError(error)}`,
                KeyManagerErrorCodes.SIGNING_FAILED,
            );
        }
    }

    async verifySignature(
        payload: string,
        signature: string,
    ): Promise<boolean> {
        try {
            return await hwVerifySignature(
                WALLET_KEY_ALIAS,
                payload,
                signature,
            );
        } catch (error) {
            throw new KeyManagerError(
                `Hardware signature verification failed: ${stringifyError(error)}`,
                KeyManagerErrorCodes.VERIFICATION_FAILED,
            );
        }
    }
}

function stringifyError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
