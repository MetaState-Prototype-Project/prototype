import type { KeyManager, SoftwareKeyPair } from "./types";
import {
    KeyManagerError,
    KeyManagerErrorCodes,
    WALLET_KEY_ALIAS,
} from "./types";

const STORAGE_KEY = `eid-wallet-software-key:${WALLET_KEY_ALIAS}`;
const LEGACY_STORAGE_KEY = "eid-wallet-software-keys-software-key-default";

/**
 * Software key manager. ECDSA P-256 via Web Crypto, stored in localStorage.
 * One key per wallet — keyed by WALLET_KEY_ALIAS.
 *
 * Public keys are returned in `z<hex-of-SPKI>` form to match the multibase-like
 * shape the hardware plugin emits, so the eVault sees identical strings either way.
 */
export class SoftwareKeyManager implements KeyManager {
    getType(): "hardware" | "software" {
        return "software";
    }

    async exists(): Promise<boolean> {
        try {
            return localStorage.getItem(STORAGE_KEY) !== null;
        } catch (error) {
            throw new KeyManagerError(
                `Software key exists check failed: ${stringifyError(error)}`,
                KeyManagerErrorCodes.STORAGE_ERROR,
            );
        }
    }

    async generate(): Promise<void> {
        try {
            if (await this.exists()) return;

            const keyPair = await crypto.subtle.generateKey(
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["sign", "verify"],
            );

            const privateKeyBuffer = await crypto.subtle.exportKey(
                "pkcs8",
                keyPair.privateKey,
            );
            const publicKeyBuffer = await crypto.subtle.exportKey(
                "spki",
                keyPair.publicKey,
            );

            const data: SoftwareKeyPair = {
                privateKey: arrayBufferToBase64(privateKeyBuffer),
                publicKey: arrayBufferToBase64(publicKeyBuffer),
                createdAt: new Date().toISOString(),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            if (error instanceof KeyManagerError) throw error;
            throw new KeyManagerError(
                `Software key generation failed: ${stringifyError(error)}`,
                KeyManagerErrorCodes.KEY_GENERATION_FAILED,
            );
        }
    }

    async getPublicKey(): Promise<string> {
        const keyPair = this.#read();
        const buf = base64ToArrayBuffer(keyPair.publicKey);
        return `z${arrayBufferToHex(buf)}`;
    }

    async signPayload(payload: string): Promise<string> {
        try {
            const keyPair = this.#read();
            const privateKey = await crypto.subtle.importKey(
                "pkcs8",
                base64ToArrayBuffer(keyPair.privateKey),
                { name: "ECDSA", namedCurve: "P-256" },
                false,
                ["sign"],
            );
            const signature = await crypto.subtle.sign(
                { name: "ECDSA", hash: "SHA-256" },
                privateKey,
                new TextEncoder().encode(payload),
            );
            return arrayBufferToBase64(signature);
        } catch (error) {
            if (error instanceof KeyManagerError) throw error;
            throw new KeyManagerError(
                `Software signing failed: ${stringifyError(error)}`,
                KeyManagerErrorCodes.SIGNING_FAILED,
            );
        }
    }

    async verifySignature(
        payload: string,
        signature: string,
    ): Promise<boolean> {
        try {
            const keyPair = this.#read();
            const publicKey = await crypto.subtle.importKey(
                "spki",
                base64ToArrayBuffer(keyPair.publicKey),
                { name: "ECDSA", namedCurve: "P-256" },
                false,
                ["verify"],
            );
            return await crypto.subtle.verify(
                { name: "ECDSA", hash: "SHA-256" },
                publicKey,
                base64ToArrayBuffer(signature),
                new TextEncoder().encode(payload),
            );
        } catch (error) {
            if (error instanceof KeyManagerError) throw error;
            throw new KeyManagerError(
                `Software signature verification failed: ${stringifyError(error)}`,
                KeyManagerErrorCodes.VERIFICATION_FAILED,
            );
        }
    }

    #read(): SoftwareKeyPair {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            throw new KeyManagerError(
                "Software key not found",
                KeyManagerErrorCodes.KEY_NOT_FOUND,
            );
        }
        try {
            return JSON.parse(stored) as SoftwareKeyPair;
        } catch (error) {
            throw new KeyManagerError(
                `Software key store corrupt: ${stringifyError(error)}`,
                KeyManagerErrorCodes.STORAGE_ERROR,
            );
        }
    }
}

/**
 * One-shot migration: copy legacy "default"-keyed localStorage entry into the
 * new single-slot location, then delete the old one. Idempotent.
 */
export function migrateLegacySoftwareKey(): void {
    try {
        if (localStorage.getItem(STORAGE_KEY)) return;
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!legacy) return;
        // Legacy shape included a `keyId` field; the new shape ignores it
        // because JSON.parse keeps unknown keys but TS only sees declared ones.
        localStorage.setItem(STORAGE_KEY, legacy);
        localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (error) {
        console.warn("Legacy software-key migration failed:", error);
    }
}

function stringifyError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
