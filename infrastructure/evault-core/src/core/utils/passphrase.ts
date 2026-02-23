import { createHash, randomBytes, timingSafeEqual } from "crypto";

export interface PassphraseStrengthResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validates that a passphrase meets minimum security requirements:
 * - At least 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export function validatePassphraseStrength(passphrase: string): PassphraseStrengthResult {
    const errors: string[] = [];

    if (passphrase.length < 12) {
        errors.push("Passphrase must be at least 12 characters long");
    }
    if (!/[A-Z]/.test(passphrase)) {
        errors.push("Passphrase must contain at least one uppercase letter");
    }
    if (!/[a-z]/.test(passphrase)) {
        errors.push("Passphrase must contain at least one lowercase letter");
    }
    if (!/[0-9]/.test(passphrase)) {
        errors.push("Passphrase must contain at least one digit");
    }
    if (!/[^A-Za-z0-9]/.test(passphrase)) {
        errors.push("Passphrase must contain at least one special character");
    }

    return { valid: errors.length === 0, errors };
}

const ITERATIONS = 100_000;
const KEY_LEN = 64;
const DIGEST = "sha512";
const SALT_BYTES = 32;

function pbkdf2Async(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const { pbkdf2 } = require("crypto") as typeof import("crypto");
        pbkdf2(password, salt, ITERATIONS, KEY_LEN, DIGEST, (err, key) => {
            if (err) reject(err);
            else resolve(key);
        });
    });
}

/**
 * Hashes a passphrase with PBKDF2-SHA512 and a random salt.
 * Returns a string in the format: `iterations$salt_hex$hash_hex`
 */
export async function hashPassphrase(passphrase: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await pbkdf2Async(passphrase, salt);
    return `${ITERATIONS}$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Compares a plain-text passphrase against a stored hash string.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function comparePassphrase(passphrase: string, stored: string): Promise<boolean> {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;

    const [iterStr, saltHex, hashHex] = parts;
    const iterations = parseInt(iterStr, 10);
    if (Number.isNaN(iterations)) return false;

    const salt = Buffer.from(saltHex, "hex");
    const expectedHash = Buffer.from(hashHex, "hex");

    const { pbkdf2 } = require("crypto") as typeof import("crypto");
    const actualHash = await new Promise<Buffer>((resolve, reject) => {
        pbkdf2(passphrase, salt, iterations, KEY_LEN, DIGEST, (err, key) => {
            if (err) reject(err);
            else resolve(key);
        });
    });

    if (actualHash.length !== expectedHash.length) return false;
    return timingSafeEqual(actualHash, expectedHash);
}
