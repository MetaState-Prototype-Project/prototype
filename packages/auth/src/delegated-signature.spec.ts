import {
	buildGrantPayload,
	COMPANY_ONTOLOGY,
	DELEGATION_ONTOLOGY,
	ROLE_ONTOLOGY,
} from "@metastate-foundation/delegation";
import { SignJWT, exportJWK, generateKeyPair as generateJoseKeyPair } from "jose";
import type { KeyLike } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { verifyDelegatedSignature } from "./delegated-signature.js";
import { clearJwksCache } from "./ename-signature.js";
import { buildDelegatedSignRequest, buildGrantSignRequest } from "./sign-requests.js";
import { verifyLoginSignature } from "./verify-login.js";

const REGISTRY = "http://registry.test";
const ACME = "@acme";
const NDA = "@esigner:nda";
const NOW = new Date("2026-12-01T00:00:00.000Z");

interface Wallet {
	publicKey: string;
	sign: (payload: string) => Promise<string>;
}

/** A software-key wallet: `z` + hex SPKI public key, base64 raw signature. */
async function softwareWallet(): Promise<Wallet> {
	const pair = await crypto.subtle.generateKey(
		{ name: "ECDSA", namedCurve: "P-256" },
		true,
		["sign", "verify"],
	);
	const spki = Buffer.from(await crypto.subtle.exportKey("spki", pair.publicKey));
	return {
		publicKey: `z${spki.toString("hex")}`,
		sign: async (payload) =>
			Buffer.from(
				await crypto.subtle.sign(
					{ name: "ECDSA", hash: "SHA-256" },
					pair.privateKey,
					new TextEncoder().encode(payload),
				),
			).toString("base64"),
	};
}

type Version = {
	version: number;
	operation: string;
	ontology: string;
	parsed: Record<string, unknown> | null;
	createdAt: string;
};

/** A Registry, people's eVaults and a company eVault, all behind one fetch. */
class World {
	private registry!: { privateKey: KeyLike; jwk: Record<string, unknown> };
	private wallets = new Map<string, Wallet>();
	private history = new Map<string, Version[]>();
	private clock = Date.parse("2026-10-01T00:00:00.000Z");
	companyType: string | null = "company";
	historyCalls = 0;
	resolveCalls = 0;
	/** eNames whose Registry lookup fails, as in an outage. */
	down = new Set<string>();

	async init() {
		const { privateKey, publicKey } = await generateJoseKeyPair("ES256");
		this.registry = {
			privateKey,
			jwk: { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256" },
		};
		for (const who of ["@dir", "@bob", "@mallory"]) {
			this.wallets.set(who, await softwareWallet());
		}
		return this;
	}

	async versionsOf(id: string) {
		return this.history.get(id) ?? [];
	}

	wallet(eName: string) {
		return this.wallets.get(eName) as Wallet;
	}

	write(id: string, ontology: string, parsed: Record<string, unknown>) {
		const versions = this.history.get(id) ?? [];
		this.clock += 60_000;
		versions.push({
			version: versions.length + 1,
			operation: versions.length ? "update" : "create",
			ontology,
			parsed,
			createdAt: new Date(this.clock).toISOString(),
		});
		this.history.set(id, versions);
	}

	/** Signs a record as its grantor through the real grant request helper. */
	async signed(id: string, ontology: string, signer: string, record: Record<string, unknown>) {
		const signedAt = new Date(this.clock + 30_000).toISOString();
		const request = await buildGrantSignRequest({
			ontology,
			companyEName: ACME,
			recordId: id,
			signerEName: signer,
			record,
			redirectUri: "https://app.test/cb",
			message: "Approve",
			signedAt,
		});
		this.write(id, ontology, {
			...record,
			authorization: {
				signerEName: signer,
				signedPayload: request.payload,
				signature: await this.wallet(signer).sign(request.payload),
				signedAt,
			},
		});
	}

	private async certificate(eName: string) {
		return new SignJWT({ ename: eName, publicKey: this.wallet(eName).publicKey })
			.setProtectedHeader({ alg: "ES256", kid: "k1" })
			.setIssuedAt()
			.setExpirationTime("1h")
			.sign(this.registry.privateKey);
	}

	fetch = (async (input: string | URL | Request, init?: RequestInit) => {
		const url = new URL(input instanceof Request ? input.url : input);
		const headers = new Headers(init?.headers);
		const json = (body: unknown, status = 200) => Response.json(body, { status });

		if (url.origin === REGISTRY && url.pathname === "/resolve") {
			const who = url.searchParams.get("w3id") as string;
			this.resolveCalls++;
			if (this.down.has(who)) return json({ error: "unavailable" }, 503);
			return json({ kind: "evault", ename: who, uri: `http://evault.test/${who.slice(1)}/` });
		}
		if (url.origin === REGISTRY && url.pathname === "/.well-known/jwks.json") {
			return json({ keys: [this.registry.jwk] });
		}
		if (url.origin === "http://evault.test" && url.pathname === "/whois") {
			const who = headers.get("X-ENAME") as string;
			if (who === ACME && this.companyType === "broken") return json({}, 503);
			if (who === ACME) {
				return json({
					w3id: ACME,
					keyBindingCertificates: [],
					type: this.companyType,
					manifest: this.companyType ? { id: "company" } : null,
				});
			}
			if (!this.wallets.has(who)) return json({ keyBindingCertificates: [] });
			return json({ keyBindingCertificates: [await this.certificate(who)] });
		}
		if (url.origin === "http://evault.test" && url.pathname === "/graphql") {
			if (headers.get("X-ENAME") !== ACME || headers.get("authorization") !== "Bearer platform-token") {
				return json({ errors: [{ message: "Access denied" }] });
			}
			this.historyCalls++;
			const { variables } = JSON.parse(String(init?.body));
			const all = [...(this.history.get(variables.id) ?? [])].reverse();
			if (all.length === 0) return json({ data: { metaEnvelopeHistory: null } });
			const before = variables.after ? Number(atob(variables.after)) : Number.POSITIVE_INFINITY;
			const page = all.filter((v) => v.version < before).slice(0, variables.first);
			const last = page.at(-1);
			return json({
				data: {
					metaEnvelopeHistory: {
						edges: page.map((node) => ({ node })),
						pageInfo: {
							hasNextPage: !!last && last.version > 1,
							endCursor: last ? btoa(String(last.version)) : null,
						},
					},
				},
			});
		}
		return new Response("not found", { status: 404 });
	}) as typeof globalThis.fetch;
}

const company = (directors: string[]) => ({
	id: "acme",
	eName: ACME,
	directors,
	createdAt: "2026-10-01T00:00:00.000Z",
	updatedAt: "2026-10-01T00:00:00.000Z",
});

const role = (over: Record<string, unknown> = {}) => ({
	companyEName: ACME,
	title: "Head of Finance",
	scopes: [NDA],
	mayRedelegate: false,
	status: "active",
	createdBy: "@dir",
	createdAt: "2026-10-01T00:00:00.000Z",
	updatedAt: "2026-10-01T00:00:00.000Z",
	...over,
});

const delegation = (over: Record<string, unknown> = {}) => ({
	companyEName: ACME,
	delegateEName: "@bob",
	roleId: "role",
	title: "Head of Finance",
	scopes: [NDA],
	mayRedelegate: false,
	grantedBy: "@dir",
	status: "active",
	createdAt: "2026-10-01T00:00:00.000Z",
	updatedAt: "2026-10-01T00:00:00.000Z",
	...over,
});

async function acme() {
	const world = await new World().init();
	await world.signed("company", COMPANY_ONTOLOGY, "@dir", company(["@dir"]));
	await world.signed("role", ROLE_ONTOLOGY, "@dir", role());
	await world.signed("bob", DELEGATION_ONTOLOGY, "@dir", delegation());
	return world;
}

/** Bob signs an NDA for Acme through the real request helper. */
async function bobSigns(world: World, over: Record<string, string> = {}) {
	const { payload } = buildDelegatedSignRequest({
		onBehalfOf: ACME,
		signer: "@bob",
		scope: NDA,
		delegationId: "bob",
		documentHash: "abc123",
		session: "s-1",
		issuedAt: NOW.toISOString(),
		redirectUri: "https://esigner.test/cb",
		title: "Head of Finance",
		...over,
	});
	return { payload, signature: await world.wallet(over.signer ?? "@bob").sign(payload) };
}

const check = (world: World, signed: { payload: string; signature: string }) =>
	verifyDelegatedSignature({
		...signed,
		registryBaseUrl: REGISTRY,
		platformToken: "platform-token",
		fetch: world.fetch,
		now: NOW,
	});

beforeEach(() => clearJwksCache());

describe("verifyDelegatedSignature", () => {
	let world: World;
	beforeAll(async () => {
		world = await acme();
	});

	it("accepts a signature covered by a live delegation", async () => {
		const result = await check(world, await bobSigns(world));
		expect(result).toMatchObject({
			valid: true,
			companyEName: ACME,
			title: "Head of Finance",
			scopes: [NDA],
			chain: ["bob"],
		});
	});

	it("rejects a signature by someone other than the payload's signer", async () => {
		const signed = await bobSigns(world);
		const forged = { ...signed, signature: await world.wallet("@mallory").sign(signed.payload) };
		expect(await check(world, forged)).toMatchObject({ valid: false, error: "bad_signature" });
	});

	it("rejects a scope the delegation does not cover", async () => {
		expect(await check(world, await bobSigns(world, { scope: "@esigner:invoice" }))).toMatchObject({
			valid: false,
			error: "not_covered",
			detail: "SCOPE_NOT_DELEGATED",
		});
	});

	it("rejects a plain login session", async () => {
		const signature = await world.wallet("@bob").sign("a-login-session");
		expect(await check(world, { payload: "a-login-session", signature })).toMatchObject({
			valid: false,
			error: "invalid_payload",
		});
	});
});

describe("verifyDelegatedSignature against changing history", () => {
	it("rejects once the delegation is revoked", async () => {
		const world = await acme();
		await world.signed("bob", DELEGATION_ONTOLOGY, "@dir", {
			...delegation(),
			status: "revoked",
			revokedAt: "2026-10-02T00:00:00.000Z",
			revokedBy: "@dir",
			revocationReason: "revoked",
		});
		expect(await check(world, await bobSigns(world))).toMatchObject({
			valid: false,
			error: "chain_invalid",
			detail: "REVOKED",
		});
	});

	it("ignores a board an outsider wrote into the company eVault", async () => {
		const world = await new World().init();
		await world.signed("company", COMPANY_ONTOLOGY, "@dir", company(["@dir"]));
		await world.signed("company", COMPANY_ONTOLOGY, "@mallory", company(["@mallory"]));
		await world.signed("role", ROLE_ONTOLOGY, "@mallory", role({ createdBy: "@mallory" }));
		await world.signed("bob", DELEGATION_ONTOLOGY, "@mallory", delegation({ grantedBy: "@mallory" }));
		expect(await check(world, await bobSigns(world))).toMatchObject({
			valid: false,
			error: "chain_invalid",
			detail: "NOT_FOUND",
		});
	});

	it("reads history across pages", async () => {
		const world = await acme();
		for (let i = 0; i < 150; i++) world.write("company", COMPANY_ONTOLOGY, { noise: i });
		expect(await check(world, await bobSigns(world))).toMatchObject({ valid: true });
	});

	it("refuses an eVault that is not a company", async () => {
		const world = await acme();
		world.companyType = "user";
		expect(await check(world, await bobSigns(world))).toMatchObject({
			valid: false,
			error: "not_a_company",
		});
	});
});

describe("verifyDelegatedSignature under abuse and outages", () => {
	it("reports a Registry outage as an outage, not a bad signature", async () => {
		const world = await acme();
		const signed = await bobSigns(world);
		world.down.add("@bob");
		expect(await check(world, signed)).toMatchObject({ valid: false, error: "resolve_failed" });
	});

	it("reports an outage hit while checking a director's grant", async () => {
		const world = await acme();
		const signed = await bobSigns(world);
		world.down.add("@dir");
		expect(await check(world, signed)).toMatchObject({ valid: false, error: "resolve_failed" });
	});

	it("reports a company /whois outage as an outage", async () => {
		const world = await acme();
		world.companyType = "broken";
		expect(await check(world, await bobSigns(world))).toMatchObject({ valid: false, error: "resolve_failed" });
	});

	it("returns the normalised signer for storing a grant", async () => {
		const request = await buildGrantSignRequest({
			ontology: ROLE_ONTOLOGY,
			companyEName: "acme",
			recordId: "role",
			signerEName: "dir",
			record: role(),
			redirectUri: "https://app.test/cb",
			message: "Create role",
		});
		expect(request.signerEName).toBe("@dir");
		expect(request.payload).toContain('"signer":"@dir"');
	});

	it("looks up each signer once and caps how many it looks up", async () => {
		const world = await acme();
		const [bob] = (await world.versionsOf("bob")) as Version[];
		const { authorization: _drop, ...record } = bob.parsed as Record<string, unknown>;
		// Forged grants naming fifty different signers, written after the real one.
		for (let i = 0; i < 50; i++) {
			const signer = `@forger${i}`;
			const signedAt = new Date(Date.parse("2026-10-01T02:00:00.000Z") + i * 60_000).toISOString();
			const signedPayload = await buildGrantPayload({
				ontology: DELEGATION_ONTOLOGY,
				companyEName: ACME,
				recordId: "bob",
				signerEName: signer,
				signedAt,
				record,
			});
			world.write("bob", DELEGATION_ONTOLOGY, {
				...record,
				authorization: { signerEName: signer, signedPayload, signature: "AAAA", signedAt },
			});
		}
		world.resolveCalls = 0;
		expect(await check(world, await bobSigns(world))).toMatchObject({ valid: true });
		// The company, the real signers, then at most the signer cap.
		expect(world.resolveCalls).toBeLessThanOrEqual(1 + 32);
	});

	it("accepts requests built with bare eNames", async () => {
		const world = await acme();
		const { payload } = buildDelegatedSignRequest({
			onBehalfOf: "acme",
			signer: "bob",
			scope: NDA,
			delegationId: "bob",
			documentHash: "abc123",
			session: "s-1",
			issuedAt: NOW.toISOString(),
			redirectUri: "https://esigner.test/cb",
			title: "Head of Finance",
		});
		const signature = await world.wallet("@bob").sign(payload);
		expect(await check(world, { payload, signature })).toMatchObject({ valid: true });
	});
});

describe("sign requests", () => {
	it("makes the signed payload the session and keeps names readable", () => {
		const { uri, payload } = buildDelegatedSignRequest({
			onBehalfOf: ACME,
			signer: "@bob",
			scope: NDA,
			delegationId: "bob",
			documentHash: "abc",
			session: "s-1",
			redirectUri: "https://esigner.test/cb",
			title: "Directrice Générale",
			companyName: "Ünïcode Ltd",
		});
		const url = new URL(uri);
		expect(url.protocol).toBe("w3ds:");
		expect(url.searchParams.get("session")).toBe(payload);
		expect(url.searchParams.get("redirect_uri")).toBe("https://esigner.test/cb");
		// The wallet decodes data with atob, then JSON.parse.
		const data = JSON.parse(atob(url.searchParams.get("data") as string));
		expect(data.message).toBe("Signing as Directrice Générale for Ünïcode Ltd");
		expect(data.sessionId).toBe(payload);
	});

	it("builds the grant payload the delegation package expects", async () => {
		const record = role();
		const request = await buildGrantSignRequest({
			ontology: ROLE_ONTOLOGY,
			companyEName: ACME,
			recordId: "role",
			signerEName: "@dir",
			record,
			redirectUri: "https://app.test/cb",
			message: "Create role",
			signedAt: "2026-10-01T00:00:00.000Z",
		});
		expect(request.payload).toBe(
			await buildGrantPayload({
				ontology: ROLE_ONTOLOGY,
				companyEName: ACME,
				recordId: "role",
				signerEName: "@dir",
				signedAt: "2026-10-01T00:00:00.000Z",
				record,
			}),
		);
	});
});

describe("verifyLoginSignature", () => {
	it("never accepts a delegated or grant payload as a login", async () => {
		const result = await verifyLoginSignature({
			eName: "@bob",
			signature: "anything",
			session: 'w3ds-sign/v1\n{"x":1}',
			registryBaseUrl: REGISTRY,
		});
		expect(result).toEqual({ valid: false, error: "reserved_payload" });
	});
});
