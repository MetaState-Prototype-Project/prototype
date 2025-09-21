import type { KeyManager, SoftwareKeyPair } from './types';
import { KeyManagerError, KeyManagerErrorCodes } from './types';

/**
 * Software key manager implementation using Web Crypto API and localStorage
 */
export class SoftwareKeyManager implements KeyManager {
    private readonly storageKey = 'eid-wallet-software-keys';
    private readonly keyPrefix = 'software-key-';

    getType(): 'hardware' | 'software' {
        return 'software';
    }

    async exists(keyId: string): Promise<boolean> {
        try {
            const storageKey = this.getStorageKey(keyId);
            const stored = localStorage.getItem(storageKey);
            return stored !== null;
        } catch (error) {
            console.error('Software key exists check failed:', error);
            throw new KeyManagerError(
                'Failed to check if software key exists',
                KeyManagerErrorCodes.STORAGE_ERROR,
                keyId
            );
        }
    }

    async generate(keyId: string): Promise<string | undefined> {
        try {
            // Check if key already exists
            if (await this.exists(keyId)) {
                console.log(`Software key ${keyId} already exists`);
                return 'key-exists';
            }

            // Generate a new key pair using Web Crypto API
            const keyPair = await crypto.subtle.generateKey(
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256',
                },
                true, // extractable
                ['sign', 'verify']
            );

            // Export the private key
            const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
            const privateKeyString = this.arrayBufferToBase64(privateKeyBuffer);

            // Export the public key
            const publicKeyBuffer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
            const publicKeyString = this.arrayBufferToBase64(publicKeyBuffer);

            // Store the key pair
            const keyPairData: SoftwareKeyPair = {
                privateKey: privateKeyString,
                publicKey: publicKeyString,
                keyId,
                createdAt: new Date().toISOString(),
            };

            const storageKey = this.getStorageKey(keyId);
            localStorage.setItem(storageKey, JSON.stringify(keyPairData));

            console.log(`Software key pair generated and stored for ${keyId}`);
            return 'key-generated';
        } catch (error) {
            console.error('Software key generation failed:', error);
            throw new KeyManagerError(
                'Failed to generate software key',
                KeyManagerErrorCodes.KEY_GENERATION_FAILED,
                keyId
            );
        }
    }

    async getPublicKey(keyId: string): Promise<string | undefined> {
        try {
            const keyPair = await this.getKeyPair(keyId);
            if (!keyPair) {
                throw new KeyManagerError(
                    'Software key not found',
                    KeyManagerErrorCodes.KEY_NOT_FOUND,
                    keyId
                );
            }

            // Convert the stored public key to a format compatible with the hardware API
            // The hardware API returns multibase hex format, so we'll convert our base64 to hex
            const publicKeyBuffer = this.base64ToArrayBuffer(keyPair.publicKey);
            const publicKeyHex = this.arrayBufferToHex(publicKeyBuffer);
            
            // Add multibase prefix (assuming 'z' for base58btc, but we'll use hex for simplicity)
            return `z${publicKeyHex}`;
        } catch (error) {
            console.error('Software public key retrieval failed:', error);
            if (error instanceof KeyManagerError) {
                throw error;
            }
            throw new KeyManagerError(
                'Failed to get software public key',
                KeyManagerErrorCodes.KEY_NOT_FOUND,
                keyId
            );
        }
    }

    async signPayload(keyId: string, payload: string): Promise<string> {
        try {
            const keyPair = await this.getKeyPair(keyId);
            if (!keyPair) {
                throw new KeyManagerError(
                    'Software key not found',
                    KeyManagerErrorCodes.KEY_NOT_FOUND,
                    keyId
                );
            }

            // Import the private key
            const privateKeyBuffer = this.base64ToArrayBuffer(keyPair.privateKey);
            const privateKey = await crypto.subtle.importKey(
                'pkcs8',
                privateKeyBuffer,
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256',
                },
                false,
                ['sign']
            );

            // Convert payload to ArrayBuffer
            const payloadBuffer = new TextEncoder().encode(payload);

            // Sign the payload
            const signature = await crypto.subtle.sign(
                {
                    name: 'ECDSA',
                    hash: 'SHA-256',
                },
                privateKey,
                payloadBuffer
            );

            // Convert signature to base64 string
            const signatureString = this.arrayBufferToBase64(signature);
            console.log(`Software signature created for ${keyId}`);
            return signatureString;
        } catch (error) {
            console.error('Software signing failed:', error);
            if (error instanceof KeyManagerError) {
                throw error;
            }
            throw new KeyManagerError(
                'Failed to sign payload with software key',
                KeyManagerErrorCodes.SIGNING_FAILED,
                keyId
            );
        }
    }

    async verifySignature(keyId: string, payload: string, signature: string): Promise<boolean> {
        try {
            const keyPair = await this.getKeyPair(keyId);
            if (!keyPair) {
                throw new KeyManagerError(
                    'Software key not found',
                    KeyManagerErrorCodes.KEY_NOT_FOUND,
                    keyId
                );
            }

            // Import the public key
            const publicKeyBuffer = this.base64ToArrayBuffer(keyPair.publicKey);
            const publicKey = await crypto.subtle.importKey(
                'spki',
                publicKeyBuffer,
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256',
                },
                false,
                ['verify']
            );

            // Convert payload and signature to ArrayBuffers
            const payloadBuffer = new TextEncoder().encode(payload);
            const signatureBuffer = this.base64ToArrayBuffer(signature);

            // Verify the signature
            const isValid = await crypto.subtle.verify(
                {
                    name: 'ECDSA',
                    hash: 'SHA-256',
                },
                publicKey,
                signatureBuffer,
                payloadBuffer
            );

            console.log(`Software signature verification for ${keyId}:`, isValid);
            return isValid;
        } catch (error) {
            console.error('Software signature verification failed:', error);
            if (error instanceof KeyManagerError) {
                throw error;
            }
            throw new KeyManagerError(
                'Failed to verify signature with software key',
                KeyManagerErrorCodes.VERIFICATION_FAILED,
                keyId
            );
        }
    }

    private async getKeyPair(keyId: string): Promise<SoftwareKeyPair | null> {
        try {
            const storageKey = this.getStorageKey(keyId);
            const stored = localStorage.getItem(storageKey);
            if (!stored) {
                return null;
            }
            return JSON.parse(stored) as SoftwareKeyPair;
        } catch (error) {
            console.error('Failed to retrieve key pair from storage:', error);
            return null;
        }
    }

    private getStorageKey(keyId: string): string {
        return `${this.storageKey}-${this.keyPrefix}${keyId}`;
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    private arrayBufferToHex(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        return Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}
