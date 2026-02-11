import { createLocalJWKSet, jwtVerify } from "jose";
import type { CryptoAdapter } from "./crypto-adapter.js";

export interface SyncPublicKeyOptions {
	evaultUri: string;
	eName: string;
	keyId?: string;
	context: string;
	authToken?: string | null;
	registryUrl?: string;
}

/**
 * Sync public key to eVault: GET /whois, optionally skip if current key already in certs, then PATCH /public-key.
 * Does not touch localStorage; caller can set publicKeySaved_* if desired.
 */
export async function syncPublicKeyToEvault(
	adapter: CryptoAdapter,
	options: SyncPublicKeyOptions,
): Promise<void> {
	const keyId = options.keyId ?? "default";

	const whoisUrl = new URL("/whois", options.evaultUri).toString();
	const whoisRes = await fetch(whoisUrl, {
		headers: { "X-ENAME": options.eName },
	});
	if (!whoisRes.ok) {
		throw new Error(
			`Whois failed: ${whoisRes.status} ${whoisRes.statusText}`,
		);
	}
	const whoisData = (await whoisRes.json()) as {
		keyBindingCertificates?: string[];
	};
	const keyBindingCertificates = whoisData?.keyBindingCertificates;

	const currentPublicKey = await adapter.getPublicKey(keyId, options.context);
	if (!currentPublicKey) {
		throw new Error(
			`No public key for keyId=${keyId} context=${options.context}`,
		);
	}

	// If we have certs and registry URL, check if current key is already present (optional verification)
	if (
		keyBindingCertificates &&
		Array.isArray(keyBindingCertificates) &&
		keyBindingCertificates.length > 0 &&
		options.registryUrl
	) {
		try {
			const jwksUrl = new URL(
				"/.well-known/jwks.json",
				options.registryUrl,
			).toString();
			const jwksRes = await fetch(jwksUrl);
			if (jwksRes.ok) {
				const jwks = (await jwksRes.json()) as { keys?: unknown[] };
				const JWKS = createLocalJWKSet(
					{ keys: Array.isArray(jwks?.keys) ? jwks.keys : [] } as Parameters<
						typeof createLocalJWKSet
					>[0],
				);
				for (const jwt of keyBindingCertificates) {
					try {
						const { payload } = await jwtVerify(jwt as string, JWKS);
						if ((payload as { ename?: string }).ename !== options.eName) {
							continue;
						}
						const extracted = (payload as { publicKey?: string }).publicKey;
						if (extracted === currentPublicKey) {
							return; // already synced
						}
					} catch {
						// try next cert
					}
				}
			}
		} catch {
			// continue to PATCH
		}
	}

	const patchUrl = new URL("/public-key", options.evaultUri).toString();
	const headers: Record<string, string> = {
		"X-ENAME": options.eName,
		"Content-Type": "application/json",
	};
	if (options.authToken) {
		headers.Authorization = `Bearer ${options.authToken}`;
	}
	const patchRes = await fetch(patchUrl, {
		method: "PATCH",
		headers,
		body: JSON.stringify({ publicKey: currentPublicKey }),
	});
	if (!patchRes.ok) {
		throw new Error(
			`PATCH public-key failed: ${patchRes.status} ${patchRes.statusText}`,
		);
	}
}
