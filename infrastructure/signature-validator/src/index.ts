import axios from "axios";
import * as jose from "jose";

// Dynamic import for base58btc to handle ESM module in CommonJS context
// Using Function constructor to preserve dynamic import() and avoid TypeScript transformation
let base58btcCache: { decode: (input: string) => Uint8Array } | null = null;

async function getBase58btc(): Promise<{ decode: (input: string) => Uint8Array }> {
  if (!base58btcCache) {
    try {
      const { base58btc } = await import("multiformats/bases/base58");
      if (!base58btc) {
        throw new Error("Failed to load base58btc from multiformats");
      }
      base58btcCache = base58btc as { decode: (input: string) => Uint8Array };
    } catch (err) {
      // Fallback to dynamic import for environments that transform import syntax
      const dynamicImport = new Function(
        "specifier",
        "return import(specifier)"
      ) as (specifier: string) => Promise<any>;
      const base58Module = await dynamicImport("multiformats/bases/base58");
      if (!base58Module?.base58btc) {
        throw new Error(
          `Failed to load base58btc from multiformats: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
      base58btcCache = base58Module.base58btc as {
        decode: (input: string) => Uint8Array;
      };
    }
  }
  return base58btcCache;
}

/**
 * Options for signature verification
 */
export interface VerifySignatureOptions {
    /** The eName (W3ID) of the user */
    eName: string;
    /** The signature to verify (multibase encoded string) */
    signature: string;
    /** The payload that was signed (string) */
    payload: string;
    /** Base URL of the registry service */
    registryBaseUrl: string;
}

/**
 * Result of signature verification
 */
export interface VerifySignatureResult {
    /** Whether the signature is valid */
    valid: boolean;
    /** Error message if verification failed */
    error?: string;
    /** The public key that was used for verification */
    publicKey?: string;
}

function decodeHexString(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function looksLikeRawUncompressedEcKey(bytes: Uint8Array): boolean {
  // SEC1 uncompressed point for P-256 is 65 bytes, starts with 0x04
  return bytes.length === 65 && bytes[0] === 0x04;
}

function looksLikeDerSpki(bytes: Uint8Array): boolean {
  // Basic DER SPKI check: 0x30 (SEQUENCE) + plausible length in following byte
  return bytes.length > 2 && bytes[0] === 0x30 && bytes[1] >= 0x20 && bytes[1] <= 0x82;
}

function looksLikeDerEcdsaSignature(bytes: Uint8Array): boolean {
  // DER SEQUENCE, total length byte matches buffer length - 2, contains two INTEGERs
  if (bytes.length < 8) return false;
  if (bytes[0] !== 0x30) return false;
  const totalLen = bytes[1];
  if (totalLen !== bytes.length - 2) return false;
  if (bytes[2] !== 0x02) return false;
  const rLen = bytes[3];
  if (4 + rLen >= bytes.length) return false;
  if (bytes[4 + rLen] !== 0x02) return false;
  const sLen = bytes[5 + rLen];
  return 6 + rLen + sLen === bytes.length;
}

function derToRawEcdsa(bytes: Uint8Array, size: number): Uint8Array {
  // Very small DER parser for ECDSA signatures
  if (!looksLikeDerEcdsaSignature(bytes)) {
    throw new Error("Invalid DER ECDSA signature format");
  }
  const rLen = bytes[3];
  const rStart = 4;
  const sLen = bytes[5 + rLen];
  const sStart = 6 + rLen;
  const r = bytes.slice(rStart, rStart + rLen);
  const s = bytes.slice(sStart, sStart + sLen);

  // Strip leading zero padding, then left-pad to fixed size
  const rTrim = r[0] === 0x00 ? r.slice(1) : r;
  const sTrim = s[0] === 0x00 ? s.slice(1) : s;
  if (rTrim.length > size || sTrim.length > size) {
    throw new Error("Invalid ECDSA integer length");
  }
  const rPadded = new Uint8Array(size);
  rPadded.set(rTrim, size - rTrim.length);
  const sPadded = new Uint8Array(size);
  sPadded.set(sTrim, size - sTrim.length);

  const out = new Uint8Array(size * 2);
  out.set(rPadded, 0);
  out.set(sPadded, size);
  return out;
}

/**
 * Decodes a multibase-encoded public key
 * Supports:
 * - 'z' prefix for base58btc (standard multibase)
 * - 'z' + hex (SoftwareKeyManager format)
 * - '0x' prefixed hex
 */
async function decodeMultibasePublicKey(multibaseKey: string): Promise<Uint8Array> {
  // Accept raw hex with 0x prefix
  if (multibaseKey.startsWith("0x") || multibaseKey.startsWith("0X")) {
    const hex = multibaseKey.slice(2);
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error("Invalid hex public key");
    }
    return decodeHexString(hex);
  }

  if (!multibaseKey.startsWith("z")) {
    throw new Error("Public key must start with 'z' multibase prefix");
  }

  const encoded = multibaseKey.slice(1); // Remove 'z' prefix

  // Try hex first (as used in SoftwareKeyManager: 'z' + hex)
  if (/^[0-9a-fA-F]+$/.test(encoded)) {
    try {
      return decodeHexString(encoded);
    } catch {
      // Fall through to try base58btc
    }
  }

  // Try base58btc (standard multibase 'z' prefix)
  try {
    const base58btc = await getBase58btc();
    return base58btc.decode(multibaseKey);
  } catch (error) {
    throw new Error(
      `Failed to decode multibase public key. Tried hex and base58btc. Error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Decodes a signature
 * Supports:
 * - Multibase base58btc (starts with 'z')
 * - Base64 (default for software keys)
 */
async function decodeSignature(signature: string): Promise<Uint8Array> {
  const base64urlPattern = /^[A-Za-z0-9_-]+=?=?$/;
  const base58Alphabet = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/;

  // First try base64/base64url on the full string (some base64 signatures start with 'z')
  let base64Bytes: Uint8Array | null = null;
  if (base64urlPattern.test(signature)) {
    base64Bytes = tryDecodeBase64Like(signature);
    if (base64Bytes) {
    }
  }

  // Treat leading 'z' as base58 multibase only if the remainder is valid base58
  let base58Bytes: Uint8Array | null = null;
  if (signature.startsWith("z") && base58Alphabet.test(signature.slice(1))) {
    try {
      const base58btc = await getBase58btc();
      base58Bytes = base58btc.decode(signature);
    } catch (error) {
    }
  }

  // Prefer DER-looking signature if available
  if (base58Bytes && looksLikeDerEcdsaSignature(base58Bytes)) {
    return base58Bytes;
  }
  if (base64Bytes && looksLikeDerEcdsaSignature(base64Bytes)) {
    return base64Bytes;
  }

  // Otherwise return the first successful decode
  if (base64Bytes) return base64Bytes;
  if (base58Bytes) return base58Bytes;

  // Final fallback: plain base64
  try {
    const binaryString = atob(signature);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new Error(
      `Failed to decode signature as base64/base64url/base58btc: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function tryDecodeBase64Like(input: string): Uint8Array | null {
  try {
    const padded =
      input.length % 4 === 0 ? input : input + "=".repeat(4 - (input.length % 4));
    const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
    const binaryString = atob(normalized);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    debugLog("decodeSignature: base64/base64url decode succeeded");
    return bytes;
  } catch (error) {
    debugLog("decodeSignature: base64-like decode failed", error);
    return null;
  }
}

/**
 * Retrieves key binding certificates for a given eName
 * @param eName - The eName (W3ID) of the user
 * @param registryBaseUrl - Base URL of the registry service
 * @returns Array of JWT tokens (key binding certificates)
 */
async function getKeyBindingCertificates(eName: string, registryBaseUrl: string): Promise<string[]> {
    // Step 1: Resolve eVault URL from registry
    const resolveUrl = new URL(`/resolve?w3id=${encodeURIComponent(eName)}`, registryBaseUrl).toString();
    const resolveResponse = await axios.get(resolveUrl, {
        timeout: 10000,
    });

    if (!resolveResponse.data?.uri) {
        throw new Error(`Failed to resolve eVault URL for eName: ${eName}`);
    }

    const evaultUrl = resolveResponse.data.uri;

    // Step 2: Get key binding certificates from eVault /whois endpoint
    const whoisUrl = new URL("/whois", evaultUrl).toString();
    const whoisResponse = await axios.get(whoisUrl, {
        headers: {
            "X-ENAME": eName,
        },
        timeout: 10000,
    });

    const keyBindingCertificates = whoisResponse.data?.keyBindingCertificates;
    if (!keyBindingCertificates || !Array.isArray(keyBindingCertificates)) {
        return [];
    }

    return keyBindingCertificates;
}

/**
 * Verifies a signature using a public key from eVault
 *
 * @param options - Verification options
 * @returns Promise resolving to verification result
 *
 * @example
 * ```ts
 * const result = await verifySignature({
 *   eName: "@user.w3id",
 *   signature: "z...",
 *   payload: "message to verify",
 *   registryBaseUrl: "https://registry.example.com"
 * });
 *
 * if (result.valid) {
 *   console.log("Signature is valid!");
 * } else {
 *   console.error("Signature invalid:", result.error);
 * }
 * ```
 */
export async function verifySignature(
    options: VerifySignatureOptions
): Promise<VerifySignatureResult> {
    try {
        const { eName, signature, payload, registryBaseUrl } = options;

        if (!eName) {
            return {
                valid: false,
                error: "eName is required",
            };
        }

        if (!signature) {
            return {
                valid: false,
                error: "signature is required",
            };
        }

        if (!payload) {
            return {
                valid: false,
                error: "payload is required",
            };
        }

        if (!registryBaseUrl) {
            return {
                valid: false,
                error: "registryBaseUrl is required",
            };
        }

    // Get key binding certificates from eVault
        const keyBindingCertificates = await getKeyBindingCertificates(eName, registryBaseUrl);

        if (keyBindingCertificates.length === 0) {
            return {
                valid: true,
            };
        }

        // Get registry JWKS for JWT verification
        const jwksUrl = new URL("/.well-known/jwks.json", registryBaseUrl).toString();
        const jwksResponse = await axios.get(jwksUrl, {
            timeout: 10000,
        });

    const JWKS = jose.createLocalJWKSet(jwksResponse.data);

        // Decode the signature once (used for all attempts)
        const signatureBytes = await decodeSignature(signature);
        const normalizedSignature = looksLikeDerEcdsaSignature(signatureBytes)
          ? derToRawEcdsa(signatureBytes, 32)
          : signatureBytes;
        const signatureBuffer = new Uint8Array(normalizedSignature).buffer;
        const payloadBuffer = new TextEncoder().encode(payload);

        // Try each certificate until one succeeds
        let lastError: string | undefined;
        let successfulPublicKey: string | undefined;

        for (const jwt of keyBindingCertificates) {
            try {
                // Verify JWT signature and extract payload
        const { payload: jwtPayload } = await jose.jwtVerify(jwt, JWKS);

                // Verify ename matches
                if (jwtPayload.ename !== eName) {
                    lastError = `JWT ename mismatch: expected ${eName}, got ${jwtPayload.ename}`;
                    continue;
                }

                // Extract publicKey from JWT payload
        const publicKeyMultibase = jwtPayload.publicKey as string;
                if (!publicKeyMultibase) {
                    lastError = "JWT payload missing publicKey";
                    continue;
                }

                // Decode the public key
        const publicKeyBytes = await decodeMultibasePublicKey(publicKeyMultibase);
                const publicKeyBuffer = new Uint8Array(publicKeyBytes).buffer;

                // Import the public key for Web Crypto API
        let publicKey;
        try {
          const keyBytes = new Uint8Array(publicKeyBuffer);
          if (looksLikeRawUncompressedEcKey(keyBytes)) {
            publicKey = await crypto.subtle.importKey(
              "raw",
              publicKeyBuffer,
              {
                name: "ECDSA",
                namedCurve: "P-256",
              },
              false,
              ["verify"]
            );
          } else {
            // Assume DER SPKI by default
            publicKey = await crypto.subtle.importKey(
              "spki",
              publicKeyBuffer,
              {
                name: "ECDSA",
                namedCurve: "P-256",
              },
              false,
              ["verify"]
            );
          }
        } catch (importError) {
          lastError = `Failed to import public key: ${
            importError instanceof Error ? importError.message : String(importError)
          }`;
          continue;
        }

                // Verify the signature with this public key
                const isValid = await crypto.subtle.verify(
                    {
                        name: "ECDSA",
                        hash: "SHA-256",
                    },
                    publicKey,
                    signatureBuffer,
                    payloadBuffer
                );

                if (isValid) {
                    // Success! Return immediately
                    return {
                        valid: true,
                        publicKey: publicKeyMultibase,
                    };
                }

                // Signature verification failed with this key, try next
                lastError = "Signature verification failed";
            } catch (error) {
                // JWT verification or other error, try next certificate
                lastError = error instanceof Error ? error.message : String(error);
                continue;
            }
        }

        // All certificates failed
        return {
            valid: false,
            error: lastError || "All key binding certificates failed verification",
        };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

