/**
 * Client secret hashing. Secrets are only ever stored hashed, in one of two
 * formats:
 *
 *   scrypt:<N>:<r>:<p>:<salt b64url>:<hash b64url>   (default)
 *   sha256:<hex>                                     (high-entropy secrets only)
 *
 * Comparisons are constant-time.
 */

import {
    createHash,
    randomBytes,
    scrypt as scryptCallback,
    timingSafeEqual,
} from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;

function scrypt(
    secret: string,
    salt: Buffer,
    n: number,
    r: number,
    p: number,
    length: number,
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        scryptCallback(
            secret,
            salt,
            length,
            { N: n, r, p, maxmem: 256 * n * r + 1024 * 1024 },
            (error, key) => (error ? reject(error) : resolve(key)),
        );
    });
}

export async function hashSecret(secret: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scrypt(
        secret,
        salt,
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        KEY_LENGTH,
    );
    return [
        "scrypt",
        SCRYPT_N,
        SCRYPT_R,
        SCRYPT_P,
        salt.toString("base64url"),
        key.toString("base64url"),
    ].join(":");
}

/** True if `stored` is a hash this module can verify. */
export function isSupportedHash(stored: string): boolean {
    return parseHash(stored) !== null;
}

type ParsedHash =
    | { kind: "sha256"; digest: Buffer }
    | {
          kind: "scrypt";
          n: number;
          r: number;
          p: number;
          salt: Buffer;
          key: Buffer;
      };

function parseHash(stored: string): ParsedHash | null {
    const parts = stored.split(":");
    if (parts[0] === "sha256" && parts.length === 2) {
        if (!/^[0-9a-f]{64}$/i.test(parts[1])) return null;
        return { kind: "sha256", digest: Buffer.from(parts[1], "hex") };
    }
    if (parts[0] === "scrypt" && parts.length === 6) {
        const [n, r, p] = parts.slice(1, 4).map(Number);
        const salt = Buffer.from(parts[4], "base64url");
        const key = Buffer.from(parts[5], "base64url");
        const powerOfTwo = Number.isInteger(n) && n > 1 && (n & (n - 1)) === 0;
        if (
            !powerOfTwo ||
            n > 2 ** 20 ||
            !Number.isInteger(r) ||
            r < 1 ||
            r > 32 ||
            !Number.isInteger(p) ||
            p < 1 ||
            p > 16 ||
            salt.length < 8 ||
            key.length < 16
        ) {
            return null;
        }
        return { kind: "scrypt", n, r, p, salt, key };
    }
    return null;
}

export async function verifySecret(
    secret: string,
    stored: string,
): Promise<boolean> {
    const parsed = parseHash(stored);
    if (!parsed) return false;
    if (parsed.kind === "sha256") {
        const candidate = createHash("sha256").update(secret, "utf8").digest();
        return timingSafeEqual(candidate, parsed.digest);
    }
    const candidate = await scrypt(
        secret,
        parsed.salt,
        parsed.n,
        parsed.r,
        parsed.p,
        parsed.key.length,
    );
    return timingSafeEqual(candidate, parsed.key);
}

/**
 * A fixed hash checked when the client ID is unknown, so a failed lookup costs
 * the same as a wrong secret and response times do not reveal which client
 * IDs exist.
 */
export const DUMMY_HASH = [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    Buffer.alloc(16).toString("base64url"),
    Buffer.alloc(KEY_LENGTH).toString("base64url"),
].join(":");
