import axios from "axios";
import * as jose from "jose";

// Lazy initialization for base58btc to handle ESM module resolution
let base58btcModule: { base58btc: { decode: (input: string) => Uint8Array } } | null = null;

async function getBase58btc() {
  if (!base58btcModule) {
    base58btcModule = await import("multiformats/bases/base58");
  }
  return base58btcModule.base58btc;
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

/**
 * Decodes a multibase-encoded public key
 * Supports 'z' prefix for base58btc or hex encoding
 * Based on the format used in SoftwareKeyManager: 'z' + hex
 */
async function decodeMultibasePublicKey(multibaseKey: string): Promise<Uint8Array> {
  if (!multibaseKey.startsWith("z")) {
    throw new Error("Public key must start with 'z' multibase prefix");
  }

  const encoded = multibaseKey.slice(1); // Remove 'z' prefix

  // Try hex first (as used in SoftwareKeyManager: 'z' + hex)
  // Check if it looks like hex (only contains 0-9, a-f, A-F)
  if (/^[0-9a-fA-F]+$/.test(encoded)) {
    try {
      if (encoded.length % 2 !== 0) {
        throw new Error("Hex string must have even length");
      }
      const bytes = new Uint8Array(encoded.length / 2);
      for (let i = 0; i < encoded.length; i += 2) {
        bytes[i / 2] = Number.parseInt(encoded.slice(i, i + 2), 16);
      }
      return bytes;
    } catch (hexError) {
      // Fall through to try base58btc
    }
  }

  // Try base58btc (standard multibase 'z' prefix)
  try {
    const base58btc = await getBase58btc();
    return base58btc.decode(encoded);
  } catch (error) {
    throw new Error(
      `Failed to decode multibase public key. Tried hex and base58btc. Error: ${error instanceof Error ? error.message : String(error)}`
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
  // If it starts with 'z', it's multibase base58btc
  if (signature.startsWith("z")) {
    try {
      const base58btc = await getBase58btc();
      return base58btc.decode(signature.slice(1));
    } catch (error) {
      throw new Error(`Failed to decode multibase signature: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Default: decode as base64 (software keys return base64-encoded signatures)
  try {
    const binaryString = atob(signature);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new Error(`Failed to decode signature as base64: ${error instanceof Error ? error.message : String(error)}`);
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
    const signatureBuffer = new Uint8Array(signatureBytes).buffer;
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
        } catch (importError) {
          lastError = `Failed to import public key: ${importError instanceof Error ? importError.message : String(importError)}`;
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

