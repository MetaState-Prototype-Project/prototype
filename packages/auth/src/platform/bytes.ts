/**
 * Encoding and canonicalisation shared by every link in the chain of trust.
 *
 * Signatures in this system are produced by three different codebases — the
 * eID wallet, GitW3 (Go) and the registry — and each picks its own encoding.
 * A verifier that insists on one representation rejects legitimate evidence,
 * so the rule here is to accept every encoding actually in use and to be
 * strict about the bytes underneath rather than about how they were written.
 */

import { createHash } from "node:crypto";

const BASE58_ALPHABET =
	"123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Serialises deterministically by sorting object keys at every depth.
 *
 * This must stay byte-for-byte identical to the Go implementation in GitW3 and
 * to `getCanonicalBindingDocumentString` in evault-core: all three hash the
 * same document and compare the results, so any divergence rejects genuine
 * evidence.
 */
export function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value) ?? "null";
	}
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`;
	}
	const record = value as Record<string, unknown>;
	const entries = Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
	return `{${entries.join(",")}}`;
}

/** The hex SHA-256 of a binding document's canonical form, signatures excluded. */
export function bindingDocumentHash(doc: {
	subject: string;
	type: string;
	data: unknown;
}): string {
	return createHash("sha256")
		.update(
			Buffer.from(
				stableStringify({
					subject: doc.subject,
					type: doc.type,
					data: doc.data,
				}),
				"utf8",
			),
		)
		.digest("hex");
}

export function sha256Base64Url(input: string): string {
	return createHash("sha256").update(input, "utf8").digest("base64url");
}

function decodeHex(value: string): Uint8Array {
	if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) {
		throw new Error("invalid hex value");
	}
	return Uint8Array.from(Buffer.from(value, "hex"));
}

export function decodeBase58(value: string): Uint8Array {
	const bytes: number[] = [];
	for (const character of value) {
		const digit = BASE58_ALPHABET.indexOf(character);
		if (digit < 0) throw new Error("invalid base58 value");
		let carry = digit;
		for (let i = 0; i < bytes.length; i += 1) {
			carry += bytes[i] * 58;
			bytes[i] = carry & 0xff;
			carry >>= 8;
		}
		while (carry > 0) {
			bytes.push(carry & 0xff);
			carry >>= 8;
		}
	}
	let leadingZeroes = 0;
	for (const character of value) {
		if (character !== "1") break;
		leadingZeroes += 1;
	}
	return Uint8Array.from([
		...Array.from({ length: leadingZeroes }, () => 0),
		...bytes.reverse(),
	]);
}

export function encodeBase58(bytes: Uint8Array): string {
	const digits: number[] = [];
	for (const byte of bytes) {
		let carry = byte;
		for (let i = 0; i < digits.length; i += 1) {
			carry += digits[i] << 8;
			digits[i] = carry % 58;
			carry = (carry / 58) | 0;
		}
		while (carry > 0) {
			digits.push(carry % 58);
			carry = (carry / 58) | 0;
		}
	}
	let prefix = "";
	for (const byte of bytes) {
		if (byte !== 0) break;
		prefix += "1";
	}
	return (
		prefix +
		digits
			.reverse()
			.map((digit) => BASE58_ALPHABET[digit])
			.join("")
	);
}

/** Decodes a public key written as multibase, 0x-hex or bare base64. */
export function decodePublicKey(value: string): Uint8Array {
	if (/^0x[0-9a-f]+$/i.test(value)) return decodeHex(value.slice(2));
	if (value.startsWith("f")) return decodeHex(value.slice(1));
	if (value.startsWith("m")) {
		return Uint8Array.from(Buffer.from(value.slice(1), "base64"));
	}
	if (!value.startsWith("z")) {
		return Uint8Array.from(Buffer.from(value, "base64"));
	}
	const encoded = value.slice(1);
	if (/^[0-9a-f]+$/i.test(encoded) && encoded.length % 2 === 0) {
		return decodeHex(encoded);
	}
	return decodeBase58(encoded);
}

function looksLikeDerSignature(value: Uint8Array): boolean {
	if (value.length < 8 || value[0] !== 0x30 || value[1] !== value.length - 2) {
		return false;
	}
	const rLength = value[3];
	if (value[2] !== 0x02 || 4 + rLength >= value.length) return false;
	if (value[4 + rLength] !== 0x02) return false;
	const sLength = value[5 + rLength];
	return 6 + rLength + sLength === value.length;
}

/** Normalises a DER-wrapped ECDSA signature to the raw r‖s WebCrypto expects. */
export function derSignatureToRaw(value: Uint8Array): Uint8Array {
	if (!looksLikeDerSignature(value)) return value;
	const rLength = value[3];
	const r = value.slice(4, 4 + rLength);
	const sLength = value[5 + rLength];
	const s = value.slice(6 + rLength, 6 + rLength + sLength);
	const raw = new Uint8Array(64);
	const normalizedR = r[0] === 0 ? r.slice(1) : r;
	const normalizedS = s[0] === 0 ? s.slice(1) : s;
	if (normalizedR.length > 32 || normalizedS.length > 32) {
		throw new Error("invalid ECDSA signature integers");
	}
	raw.set(normalizedR, 32 - normalizedR.length);
	raw.set(normalizedS, 64 - normalizedS.length);
	return raw;
}

/** Every byte string a signature may reasonably have been written as. */
export function signatureCandidates(value: string): Uint8Array[] {
	const candidates: Uint8Array[] = [];
	try {
		candidates.push(Uint8Array.from(Buffer.from(value, "base64url")));
	} catch {
		// Fall through to the multibase representation below.
	}
	if (value.startsWith("z")) {
		try {
			candidates.push(decodeBase58(value.slice(1)));
		} catch {
			// The value may simply be a base64 signature beginning with z.
		}
	}
	return candidates;
}

export function toArrayBuffer(value: Uint8Array): ArrayBuffer {
	return Uint8Array.from(value).buffer;
}
