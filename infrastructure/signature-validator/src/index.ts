import axios from "axios";

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
 * Retrieves the public key for a given eName
 * @param eName - The eName (W3ID) of the user
 * @param registryBaseUrl - Base URL of the registry service
 * @returns The public key in multibase format
 */
async function getPublicKey(eName: string, registryBaseUrl: string): Promise<string> {
  // Step 1: Resolve eVault URL from registry
  const resolveUrl = new URL(`/resolve?w3id=${encodeURIComponent(eName)}`, registryBaseUrl).toString();
  const resolveResponse = await axios.get(resolveUrl, {
    timeout: 10000,
  });

  if (!resolveResponse.data?.uri) {
    throw new Error(`Failed to resolve eVault URL for eName: ${eName}`);
  }

  const evaultUrl = resolveResponse.data.uri;

  // Step 2: Get public key from eVault /whois endpoint
  const whoisUrl = new URL("/whois", evaultUrl).toString();
  const whoisResponse = await axios.get(whoisUrl, {
    headers: {
      "X-ENAME": eName,
    },
    timeout: 10000,
  });

  const publicKey = whoisResponse.data?.publicKey;
  if (!publicKey) {
    throw new Error(`No public key found for eName: ${eName}`);
  }

  return publicKey;
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

    // Get public key from eVault
    console.log("[DEBUG] Step 1: Fetching public key from eVault...");
    const publicKeyMultibase = await getPublicKey(eName, registryBaseUrl);
    console.log(`[DEBUG] Public key retrieved (full): ${publicKeyMultibase}`);
    console.log(`[DEBUG] Public key starts with 'z': ${publicKeyMultibase.startsWith('z')}`);

    // Decode the public key
    console.log("[DEBUG] Step 2: Decoding public key...");
    const publicKeyBytes = await decodeMultibasePublicKey(publicKeyMultibase);
    console.log(`[DEBUG] Public key bytes length: ${publicKeyBytes.length}`);
    console.log(`[DEBUG] Public key bytes (hex, first 100 chars): ${Buffer.from(publicKeyBytes).toString('hex').substring(0, 100)}...`);
    console.log(`[DEBUG] Public key bytes (base64): ${Buffer.from(publicKeyBytes).toString('base64')}`);

    // Import the public key for Web Crypto API
    // The public key is in SPKI format (SubjectPublicKeyInfo)
    // Create a new ArrayBuffer from the Uint8Array
    const publicKeyBuffer = new Uint8Array(publicKeyBytes).buffer;
    
    console.log("[DEBUG] Step 3: Importing public key into Web Crypto API...");
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
      console.log("[DEBUG] Public key imported successfully");
    } catch (importError) {
      console.error(`[DEBUG] Failed to import public key: ${importError instanceof Error ? importError.message : String(importError)}`);
      throw importError;
    }

    // Decode the signature
    console.log("[DEBUG] Step 4: Decoding signature...");
    const signatureBytes = await decodeSignature(signature);
    console.log(`[DEBUG] Signature bytes length: ${signatureBytes.length}`);
    console.log(`[DEBUG] Signature bytes (hex): ${Buffer.from(signatureBytes).toString('hex')}`);

    // Convert payload to ArrayBuffer
    console.log("[DEBUG] Step 5: Encoding payload...");
    const payloadBuffer = new TextEncoder().encode(payload);
    console.log(`[DEBUG] Payload: "${payload}"`);
    console.log(`[DEBUG] Payload bytes length: ${payloadBuffer.byteLength}`);
    console.log(`[DEBUG] Payload bytes (hex): ${Buffer.from(payloadBuffer).toString('hex')}`);

    // Create a new ArrayBuffer from the signature Uint8Array
    const signatureBuffer = new Uint8Array(signatureBytes).buffer;

    // Verify the signature
    console.log("[DEBUG] Step 6: Verifying signature with Web Crypto API...");
    console.log(`[DEBUG] Algorithm: ECDSA with P-256 curve, SHA-256 hash`);
    const isValid = await crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: "SHA-256",
      },
      publicKey,
      signatureBuffer,
      payloadBuffer
    );
    console.log(`[DEBUG] Verification result: ${isValid ? "VALID" : "INVALID"}`);

    return {
      valid: isValid,
      publicKey: publicKeyMultibase,
      error: isValid ? undefined : "Signature verification failed",
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

