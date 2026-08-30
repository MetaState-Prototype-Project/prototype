/**
 * P-256 signing and verification over the encodings this system actually uses.
 */

import {
	decodePublicKey,
	derSignatureToRaw,
	encodeBase58,
	signatureCandidates,
	toArrayBuffer,
} from "./bytes.js";

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_PARAMS = { name: "ECDSA", hash: "SHA-256" } as const;

async function importPublicKey(publicKey: string): Promise<CryptoKey> {
	const bytes = decodePublicKey(publicKey);
	// An uncompressed EC point starts with 0x04 and is 65 bytes; anything else
	// we treat as a SubjectPublicKeyInfo wrapper.
	const format = bytes.length === 65 && bytes[0] === 0x04 ? "raw" : "spki";
	return crypto.subtle.importKey(
		format,
		toArrayBuffer(bytes),
		ALGORITHM,
		false,
		["verify"],
	);
}

/**
 * Verifies `signature` over `payload`. Tries each encoding the signature could
 * have been written in and returns true if any verifies, so a legitimate
 * signature is never rejected for being base58 rather than base64url.
 */
export async function verifyP256(
	publicKey: string,
	signature: string,
	payload: string,
): Promise<boolean> {
	let key: CryptoKey;
	try {
		key = await importPublicKey(publicKey);
	} catch {
		return false;
	}
	const encoded = toArrayBuffer(new TextEncoder().encode(payload));
	for (const candidate of signatureCandidates(signature)) {
		try {
			const raw = derSignatureToRaw(candidate);
			if (await crypto.subtle.verify(SIGN_PARAMS, key, toArrayBuffer(raw), encoded)) {
				return true;
			}
		} catch {
			// Try the next supported encoding.
		}
	}
	return false;
}

export interface P256KeyPair {
	/** Multibase (`z` + base58) uncompressed point, as binding documents carry it. */
	publicKey: string;
	/** PKCS#8 private key, base64. Never leaves the deployment that generated it. */
	privateKey: string;
}

export async function generateKeyPair(): Promise<P256KeyPair> {
	const pair = await crypto.subtle.generateKey(ALGORITHM, true, [
		"sign",
		"verify",
	]);
	const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
	const pkcs8 = new Uint8Array(
		await crypto.subtle.exportKey("pkcs8", pair.privateKey),
	);
	return {
		publicKey: `z${encodeBase58(raw)}`,
		privateKey: Buffer.from(pkcs8).toString("base64"),
	};
}

export async function signP256(
	privateKey: string,
	payload: string,
): Promise<string> {
	const key = await crypto.subtle.importKey(
		"pkcs8",
		toArrayBuffer(Uint8Array.from(Buffer.from(privateKey, "base64"))),
		ALGORITHM,
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		SIGN_PARAMS,
		key,
		toArrayBuffer(new TextEncoder().encode(payload)),
	);
	return Buffer.from(new Uint8Array(signature)).toString("base64url");
}
