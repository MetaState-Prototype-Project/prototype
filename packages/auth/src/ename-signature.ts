/**
 * Strict verification that an eName's wallet signed a payload.
 *
 * Unlike `verifyLoginSignature`, this fails closed: an eName with no key
 * binding certificate is rejected rather than waved through, every upstream
 * call is bounded by a timeout, and `/whois` is never cached so a revoked or
 * rotated key takes effect on the next login.
 */

import { createLocalJWKSet, errors, jwtVerify } from "jose";
import type { JSONWebKeySet, JWTVerifyGetKey } from "jose";
import { verifyP256Detailed } from "./platform/p256.js";

export type EnameKeyType = "hardware" | "software";

export type EnameVerificationError =
	| "invalid_input"
	| "resolve_failed"
	| "not_an_evault"
	| "whois_failed"
	| "no_certificates"
	| "jwks_failed"
	| "no_valid_certificate"
	| "timeout";

export interface VerifyEnameSignatureOptions {
	eName: string;
	/** The exact string the wallet signed, e.g. the login session ID. */
	payload: string;
	signature: string;
	registryBaseUrl: string;
	/** Applied to each Registry and eVault call. Defaults to 5000 ms. */
	timeoutMs?: number;
	/** How long to reuse the Registry JWKS. Defaults to 5 minutes; 0 disables. */
	jwksCacheMs?: number;
	fetch?: typeof fetch;
	signal?: AbortSignal;
}

export interface VerifyEnameSignatureResult {
	valid: boolean;
	/** The normalised eName, with its leading `@`. */
	eName?: string;
	/** The certified public key the signature verified against. */
	publicKey?: string;
	/**
	 * Inferred from the signature encoding (base58btc from hardware keys,
	 * base64 from software keys). A hint, not an attestation.
	 */
	keyType?: EnameKeyType;
	error?: EnameVerificationError;
}

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_JWKS_CACHE_MS = 5 * 60 * 1000;
const MAX_ENAME_LENGTH = 256;
const MAX_PAYLOAD_LENGTH = 1024;
const MAX_SIGNATURE_LENGTH = 1024;
const MAX_CERTIFICATES = 20;

class VerificationFailure extends Error {
	constructor(readonly code: EnameVerificationError) {
		super(code);
	}
}

const jwksCache = new Map<string, { keys: JWTVerifyGetKey; expiresAt: number }>();

/** Drops every cached Registry JWKS. */
export function clearJwksCache(): void {
	jwksCache.clear();
}

export function normalizeEName(eName: string): string {
	return `@${eName.trim().replace(/^@+/, "")}`;
}

function isTimeout(error: unknown): boolean {
	return (
		error instanceof Error &&
		(error.name === "TimeoutError" || error.name === "AbortError")
	);
}

async function getJson(
	url: URL,
	options: Required<Pick<VerifyEnameSignatureOptions, "timeoutMs" | "fetch">> & {
		signal?: AbortSignal;
		headers?: Record<string, string>;
		failure: EnameVerificationError;
	},
): Promise<unknown> {
	const signals = [AbortSignal.timeout(options.timeoutMs)];
	if (options.signal) signals.push(options.signal);
	let response: Response;
	try {
		response = await options.fetch(url, {
			headers: { accept: "application/json", ...options.headers },
			signal: AbortSignal.any(signals),
			redirect: "error",
			cache: "no-store",
		});
		if (!response.ok) throw new VerificationFailure(options.failure);
		return await response.json();
	} catch (error) {
		if (error instanceof VerificationFailure) throw error;
		if (isTimeout(error)) throw new VerificationFailure("timeout");
		throw new VerificationFailure(options.failure);
	}
}

async function registryKeys(
	registryBaseUrl: string,
	options: Required<Pick<VerifyEnameSignatureOptions, "timeoutMs" | "fetch" | "jwksCacheMs">> & {
		signal?: AbortSignal;
		refresh: boolean;
	},
): Promise<JWTVerifyGetKey> {
	const url = new URL("/.well-known/jwks.json", registryBaseUrl);
	const cached = jwksCache.get(url.href);
	if (!options.refresh && cached && cached.expiresAt > Date.now()) {
		return cached.keys;
	}
	const body = await getJson(url, { ...options, failure: "jwks_failed" });
	let keys: JWTVerifyGetKey;
	try {
		keys = createLocalJWKSet(body as JSONWebKeySet);
	} catch {
		throw new VerificationFailure("jwks_failed");
	}
	if (options.jwksCacheMs > 0) {
		jwksCache.set(url.href, { keys, expiresAt: Date.now() + options.jwksCacheMs });
	}
	return keys;
}

async function certificateClaims(
	certificate: string,
	keys: JWTVerifyGetKey,
): Promise<Record<string, unknown>> {
	const { payload } = await jwtVerify(certificate, keys, {
		algorithms: ["ES256"],
		requiredClaims: ["exp"],
		clockTolerance: 30,
	});
	return payload;
}

function httpUrl(value: unknown): URL | null {
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:" ? url : null;
	} catch {
		return null;
	}
}

/**
 * Verifies that the wallet holding `eName` signed `payload`: resolves the
 * eName's eVault at the Registry, fetches its key binding certificates, checks
 * each against the Registry's keys, and accepts if any certified key verifies
 * the signature. Never throws; every failure returns `valid: false`.
 */
export async function verifyEnameSignature(
	options: VerifyEnameSignatureOptions,
): Promise<VerifyEnameSignatureResult> {
	const { payload, signature, registryBaseUrl, signal } = options;
	if (
		typeof options.eName !== "string" ||
		typeof payload !== "string" ||
		typeof signature !== "string" ||
		typeof registryBaseUrl !== "string" ||
		options.eName.trim().replace(/^@+/, "") === "" ||
		options.eName.length > MAX_ENAME_LENGTH ||
		payload === "" ||
		payload.length > MAX_PAYLOAD_LENGTH ||
		signature === "" ||
		signature.length > MAX_SIGNATURE_LENGTH ||
		!httpUrl(registryBaseUrl)
	) {
		return { valid: false, error: "invalid_input" };
	}

	const eName = normalizeEName(options.eName);
	const request = {
		timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
		fetch: options.fetch ?? globalThis.fetch,
		signal,
	};

	try {
		const resolveUrl = new URL("/resolve", registryBaseUrl);
		resolveUrl.searchParams.set("w3id", eName);
		const resolved = (await getJson(resolveUrl, {
			...request,
			failure: "resolve_failed",
		})) as { kind?: unknown; uri?: unknown } | null;
		if (resolved?.kind !== "evault") {
			return { valid: false, eName, error: "not_an_evault" };
		}
		const evault = httpUrl(resolved.uri);
		if (!evault) return { valid: false, eName, error: "resolve_failed" };

		const whois = (await getJson(new URL("/whois", evault), {
			...request,
			headers: { "X-ENAME": eName },
			failure: "whois_failed",
		})) as { keyBindingCertificates?: unknown } | null;
		if (!Array.isArray(whois?.keyBindingCertificates)) {
			return { valid: false, eName, error: "whois_failed" };
		}
		const certificates = whois.keyBindingCertificates
			.filter((value): value is string => typeof value === "string")
			.slice(0, MAX_CERTIFICATES);
		if (certificates.length === 0) {
			return { valid: false, eName, error: "no_certificates" };
		}

		const keyOptions = {
			...request,
			jwksCacheMs: options.jwksCacheMs ?? DEFAULT_JWKS_CACHE_MS,
		};
		let keys = await registryKeys(registryBaseUrl, { ...keyOptions, refresh: false });
		let refreshed = false;

		for (const certificate of certificates) {
			let claims: Record<string, unknown>;
			try {
				claims = await certificateClaims(certificate, keys);
			} catch (error) {
				// The Registry may have rotated its key since the JWKS was cached.
				if (!(error instanceof errors.JWKSNoMatchingKey) || refreshed) continue;
				refreshed = true;
				keys = await registryKeys(registryBaseUrl, { ...keyOptions, refresh: true });
				try {
					claims = await certificateClaims(certificate, keys);
				} catch {
					continue;
				}
			}
			if (typeof claims.ename !== "string" || normalizeEName(claims.ename) !== eName) {
				continue;
			}
			if (typeof claims.publicKey !== "string") continue;
			const verification = await verifyP256Detailed(claims.publicKey, signature, payload);
			if (verification.valid) {
				return {
					valid: true,
					eName,
					publicKey: claims.publicKey,
					keyType: verification.encoding === "base58" ? "hardware" : "software",
				};
			}
		}
		return { valid: false, eName, error: "no_valid_certificate" };
	} catch (error) {
		if (error instanceof VerificationFailure) {
			return { valid: false, eName, error: error.code };
		}
		return { valid: false, eName, error: isTimeout(error) ? "timeout" : "no_valid_certificate" };
	}
}
