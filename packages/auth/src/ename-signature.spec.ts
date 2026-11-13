import { SignJWT, exportJWK, generateKeyPair as generateJoseKeyPair } from "jose";
import type { KeyLike } from "jose";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearJwksCache, verifyEnameSignature } from "./ename-signature.js";
import { encodeBase58 } from "./platform/bytes.js";
import { generateKeyPair, signP256 } from "./platform/p256.js";

const REGISTRY = "http://registry.test";
const EVAULT = "http://evault.test";
const ENAME = "@e4d1c2b0-5a6f-4c1e-9b1d-3f2a7c8e9d10";
const SESSION = "session-123";

interface RegistryKey {
	privateKey: KeyLike;
	jwk: Record<string, unknown>;
}

async function registryKey(kid: string): Promise<RegistryKey> {
	const { privateKey, publicKey } = await generateJoseKeyPair("ES256");
	return { privateKey, jwk: { ...(await exportJWK(publicKey)), kid, alg: "ES256" } };
}

async function certificate(
	key: RegistryKey,
	claims: { ename: string; publicKey: string },
	expiresIn: string | number = "1h",
): Promise<string> {
	return new SignJWT(claims)
		.setProtectedHeader({ alg: "ES256", kid: key.jwk.kid as string })
		.setIssuedAt()
		.setExpirationTime(expiresIn)
		.sign(key.privateKey);
}

/** A software-key wallet: `z` + hex SPKI public key, standard base64 raw signature. */
async function softwareWallet() {
	const pair = await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"],
	);
	const spki = Buffer.from(await crypto.subtle.exportKey("spki", pair.publicKey));
	return {
		publicKey: `z${spki.toString("hex")}`,
		sign: async (payload: string) =>
			Buffer.from(
				await crypto.subtle.sign(
					{ name: "ECDSA", hash: "SHA-256" },
					pair.privateKey,
					new TextEncoder().encode(payload),
				),
			).toString("base64"),
	};
}

function rawToDer(raw: Uint8Array): Uint8Array {
	const integer = (bytes: Uint8Array) => {
		let start = 0;
		while (start < bytes.length - 1 && bytes[start] === 0) start += 1;
		const trimmed = bytes.slice(start);
		return trimmed[0] & 0x80 ? Uint8Array.from([0, ...trimmed]) : trimmed;
	};
	const r = integer(raw.slice(0, 32));
	const s = integer(raw.slice(32));
	return Uint8Array.from([
		0x30,
		r.length + s.length + 4,
		0x02,
		r.length,
		...r,
		0x02,
		s.length,
		...s,
	]);
}

/** A hardware-key wallet: `z` + base58 raw point, `z` + base58 DER signature. */
async function hardwareWallet() {
	const pair = await generateKeyPair();
	return {
		publicKey: pair.publicKey,
		sign: async (payload: string) => {
			const raw = Buffer.from(await signP256(pair.privateKey, payload), "base64url");
			return `z${encodeBase58(rawToDer(Uint8Array.from(raw)))}`;
		},
	};
}

interface Upstream {
	resolve?: () => Response | Promise<Response>;
	whois?: () => Response | Promise<Response>;
	jwks?: () => Response | Promise<Response>;
}

function mockFetch(upstream: Upstream) {
	return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(input instanceof Request ? input.url : input);
		if (url.origin === REGISTRY && url.pathname === "/resolve") {
			return upstream.resolve?.() ?? new Response("{}", { status: 404 });
		}
		if (url.origin === REGISTRY && url.pathname === "/.well-known/jwks.json") {
			return upstream.jwks?.() ?? new Response("{}", { status: 404 });
		}
		if (url.origin === EVAULT && url.pathname === "/whois") {
			const headers = new Headers(init?.headers);
			if (headers.get("X-ENAME") !== ENAME) return new Response("{}", { status: 400 });
			return upstream.whois?.() ?? new Response("{}", { status: 404 });
		}
		return new Response("not found", { status: 404 });
	});
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

let registry: RegistryKey;

beforeAll(async () => {
	registry = await registryKey("entropy-key-1");
});

beforeEach(() => {
	clearJwksCache();
});

function happyUpstream(certificates: string[], jwks = [registry.jwk]): Upstream {
	return {
		resolve: () => json({ kind: "evault", ename: ENAME, uri: EVAULT }),
		whois: () => json({ keyBindingCertificates: certificates }),
		jwks: () => json({ keys: jwks }),
	};
}

async function verify(signature: string, fetch: typeof globalThis.fetch, extra = {}) {
	return verifyEnameSignature({
		eName: ENAME,
		payload: SESSION,
		signature,
		registryBaseUrl: REGISTRY,
		fetch,
		...extra,
	});
}

describe("verifyEnameSignature", () => {
	it("accepts a hardware key and reports it as hardware", async () => {
		const wallet = await hardwareWallet();
		const cert = await certificate(registry, { ename: ENAME, publicKey: wallet.publicKey });
		const result = await verify(await wallet.sign(SESSION), mockFetch(happyUpstream([cert])));
		expect(result).toEqual({
			valid: true,
			eName: ENAME,
			publicKey: wallet.publicKey,
			keyType: "hardware",
		});
	});

	it("accepts a software key and reports it as software", async () => {
		const wallet = await softwareWallet();
		const cert = await certificate(registry, { ename: ENAME, publicKey: wallet.publicKey });
		const result = await verify(await wallet.sign(SESSION), mockFetch(happyUpstream([cert])));
		expect(result).toMatchObject({ valid: true, keyType: "software" });
	});

	it("reports software for a base64 signature that starts with z", async () => {
		const wallet = await softwareWallet();
		const cert = await certificate(registry, { ename: ENAME, publicKey: wallet.publicKey });
		let payload = "";
		let signature = "";
		for (let i = 0; !signature.startsWith("z"); i += 1) {
			payload = `session-${i}`;
			signature = await wallet.sign(payload);
		}
		const result = await verify(signature, mockFetch(happyUpstream([cert])), { payload });
		expect(result).toMatchObject({ valid: true, keyType: "software" });
	});

	it("accepts an eName written without its @", async () => {
		const wallet = await softwareWallet();
		const cert = await certificate(registry, { ename: ENAME, publicKey: wallet.publicKey });
		const result = await verify(await wallet.sign(SESSION), mockFetch(happyUpstream([cert])), {
			eName: ENAME.slice(1),
		});
		expect(result).toMatchObject({ valid: true, eName: ENAME });
	});

	it("fails closed when the eVault returns no certificates", async () => {
		const wallet = await softwareWallet();
		const result = await verify(await wallet.sign(SESSION), mockFetch(happyUpstream([])));
		expect(result).toMatchObject({ valid: false, error: "no_certificates" });
	});

	it("rejects when /whois fails", async () => {
		const wallet = await softwareWallet();
		const fetch = mockFetch({ ...happyUpstream([]), whois: () => json({}, 500) });
		expect(await verify(await wallet.sign(SESSION), fetch)).toMatchObject({
			valid: false,
			error: "whois_failed",
		});
	});

	it("rejects an eName the Registry does not know", async () => {
		const wallet = await softwareWallet();
		const fetch = mockFetch({ ...happyUpstream([]), resolve: () => json({}, 404) });
		expect(await verify(await wallet.sign(SESSION), fetch)).toMatchObject({
			valid: false,
			error: "resolve_failed",
		});
	});

	it("rejects an eName that resolves to something other than an eVault", async () => {
		const wallet = await softwareWallet();
		const fetch = mockFetch({
			...happyUpstream([]),
			resolve: () => json({ kind: "software_version", ename: ENAME }),
		});
		expect(await verify(await wallet.sign(SESSION), fetch)).toMatchObject({
			valid: false,
			error: "not_an_evault",
		});
	});

	it("rejects an expired certificate", async () => {
		const wallet = await softwareWallet();
		const past = Math.floor(Date.now() / 1000) - 3600;
		const cert = await certificate(registry, { ename: ENAME, publicKey: wallet.publicKey }, past);
		expect(
			await verify(await wallet.sign(SESSION), mockFetch(happyUpstream([cert]))),
		).toMatchObject({ valid: false, error: "no_valid_certificate" });
	});

	it("rejects a certificate signed by a key the Registry does not publish", async () => {
		const wallet = await softwareWallet();
		const forger = await registryKey("entropy-key-1");
		const cert = await certificate(forger, { ename: ENAME, publicKey: wallet.publicKey });
		expect(
			await verify(await wallet.sign(SESSION), mockFetch(happyUpstream([cert]))),
		).toMatchObject({ valid: false, error: "no_valid_certificate" });
	});

	it("rejects a certificate issued for a different eName", async () => {
		const wallet = await softwareWallet();
		const cert = await certificate(registry, { ename: "@someone-else", publicKey: wallet.publicKey });
		expect(
			await verify(await wallet.sign(SESSION), mockFetch(happyUpstream([cert]))),
		).toMatchObject({ valid: false, error: "no_valid_certificate" });
	});

	it("accepts when a later certificate holds the signing key", async () => {
		const stale = await softwareWallet();
		const wallet = await hardwareWallet();
		const certs = [
			await certificate(registry, { ename: ENAME, publicKey: stale.publicKey }),
			await certificate(registry, { ename: ENAME, publicKey: wallet.publicKey }),
		];
		expect(
			await verify(await wallet.sign(SESSION), mockFetch(happyUpstream(certs))),
		).toMatchObject({ valid: true, publicKey: wallet.publicKey });
	});

	it("rejects a signature over a different payload", async () => {
		const wallet = await softwareWallet();
		const cert = await certificate(registry, { ename: ENAME, publicKey: wallet.publicKey });
		expect(
			await verify(await wallet.sign("another-session"), mockFetch(happyUpstream([cert]))),
		).toMatchObject({ valid: false, error: "no_valid_certificate" });
	});

	it("verifies over the session string itself, not a pre-hashed digest", async () => {
		const wallet = await softwareWallet();
		const cert = await certificate(registry, { ename: ENAME, publicKey: wallet.publicKey });
		const digest = Buffer.from(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(SESSION)),
		).toString("hex");
		const overDigest = await wallet.sign(digest);
		expect(
			await verify(overDigest, mockFetch(happyUpstream([cert]))),
		).toMatchObject({ valid: false });
	});

	it("times out a Registry that never answers", async () => {
		const wallet = await softwareWallet();
		const fetch = vi.fn(
			(_input: string | URL | Request, init?: RequestInit) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
				}),
		);
		const started = Date.now();
		const result = await verify(await wallet.sign(SESSION), fetch, { timeoutMs: 50 });
		expect(result).toMatchObject({ valid: false, error: "timeout" });
		expect(Date.now() - started).toBeLessThan(1000);
	});

	it("fetches /whois on every call but reuses the Registry JWKS", async () => {
		const wallet = await softwareWallet();
		const cert = await certificate(registry, { ename: ENAME, publicKey: wallet.publicKey });
		const fetch = mockFetch(happyUpstream([cert]));
		const signature = await wallet.sign(SESSION);
		await verify(signature, fetch);
		await verify(signature, fetch);
		const paths = fetch.mock.calls.map(([input]) => new URL(input as string | URL).pathname);
		expect(paths.filter((path) => path === "/whois")).toHaveLength(2);
		expect(paths.filter((path) => path === "/.well-known/jwks.json")).toHaveLength(1);
	});

	it("refetches the JWKS once when the Registry has rotated its key", async () => {
		const wallet = await softwareWallet();
		const signature = await wallet.sign(SESSION);
		const rotated = await registryKey("entropy-key-2");
		let jwks = [registry.jwk];
		let certs = [await certificate(registry, { ename: ENAME, publicKey: wallet.publicKey })];
		const fetch = mockFetch({
			resolve: () => json({ kind: "evault", ename: ENAME, uri: EVAULT }),
			whois: () => json({ keyBindingCertificates: certs }),
			jwks: () => json({ keys: jwks }),
		});
		// Cache the old key, then rotate the Registry to a new one.
		expect(await verify(signature, fetch)).toMatchObject({ valid: true });
		jwks = [rotated.jwk];
		certs = [await certificate(rotated, { ename: ENAME, publicKey: wallet.publicKey })];
		fetch.mockClear();
		expect(await verify(signature, fetch)).toMatchObject({ valid: true });
		const jwksCalls = fetch.mock.calls.filter(
			([input]) => new URL(input as string | URL).pathname === "/.well-known/jwks.json",
		);
		expect(jwksCalls).toHaveLength(1);
	});

	it("rejects malformed input without calling upstream", async () => {
		const fetch = mockFetch({});
		expect(await verify("", fetch)).toMatchObject({ valid: false, error: "invalid_input" });
		expect(await verify("sig", fetch, { eName: "@" })).toMatchObject({
			valid: false,
			error: "invalid_input",
		});
		expect(await verify("sig", fetch, { registryBaseUrl: "not a url" })).toMatchObject({
			valid: false,
			error: "invalid_input",
		});
		expect(fetch).not.toHaveBeenCalled();
	});
});
