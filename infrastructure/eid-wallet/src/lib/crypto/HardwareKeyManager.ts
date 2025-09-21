import type { KeyManager } from './types';
import { KeyManagerError, KeyManagerErrorCodes } from './types';
import {
    exists as hwExists,
    generate as hwGenerate,
    getPublicKey as hwGetPublicKey,
    signPayload as hwSignPayload,
    verifySignature as hwVerifySignature,
} from '@auvo/tauri-plugin-crypto-hw-api';

/**
 * Hardware key manager implementation using Tauri crypto hardware API
 */
export class HardwareKeyManager implements KeyManager {
    getType(): 'hardware' | 'software' {
        return 'hardware';
    }

    async exists(keyId: string): Promise<boolean> {
        try {
            return await hwExists(keyId);
        } catch (error) {
            console.error('Hardware key exists check failed:', error);
            throw new KeyManagerError(
                'Failed to check if hardware key exists',
                KeyManagerErrorCodes.HARDWARE_UNAVAILABLE,
                keyId
            );
        }
    }

    async generate(keyId: string): Promise<string | undefined> {
        try {
            const result = await hwGenerate(keyId);
            console.log(`Hardware key generated for ${keyId}:`, result);
            return result;
        } catch (error) {
            console.error('Hardware key generation failed:', error);
            throw new KeyManagerError(
                'Failed to generate hardware key',
                KeyManagerErrorCodes.KEY_GENERATION_FAILED,
                keyId
            );
        }
    }

    async getPublicKey(keyId: string): Promise<string | undefined> {
        try {
            const publicKey = await hwGetPublicKey(keyId);
            console.log(`Hardware public key retrieved for ${keyId}:`, publicKey);
            return publicKey;
        } catch (error) {
            console.error('Hardware public key retrieval failed:', error);
            throw new KeyManagerError(
                'Failed to get hardware public key',
                KeyManagerErrorCodes.KEY_NOT_FOUND,
                keyId
            );
        }
    }

    async signPayload(keyId: string, payload: string): Promise<string> {
        try {
            const signature = await hwSignPayload(keyId, payload);
            console.log(`Hardware signature created for ${keyId}`);
            return signature;
        } catch (error) {
            console.error('Hardware signing failed:', error);
            throw new KeyManagerError(
                'Failed to sign payload with hardware key',
                KeyManagerErrorCodes.SIGNING_FAILED,
                keyId
            );
        }
    }

    async verifySignature(keyId: string, payload: string, signature: string): Promise<boolean> {
        try {
            const isValid = await hwVerifySignature(keyId, payload, signature);
            console.log(`Hardware signature verification for ${keyId}:`, isValid);
            return isValid;
        } catch (error) {
            console.error('Hardware signature verification failed:', error);
            throw new KeyManagerError(
                'Failed to verify signature with hardware key',
                KeyManagerErrorCodes.VERIFICATION_FAILED,
                keyId
            );
        }
    }
}
