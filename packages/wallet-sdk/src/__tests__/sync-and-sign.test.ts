import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signPayload, syncPublicKeyToEvault } from "../sync-and-sign.js";
import { TestCryptoAdapter } from "./TestCryptoAdapter.js";

const CONTEXT = "onboarding";

describe("signPayload", () => {
	const adapter = new TestCryptoAdapter();

	beforeEach(async () => {
		await adapter.ensureKey("test-key-1", CONTEXT);
	});

	it("returns signature from adapter", async () => {
		const sig = await signPayload({
			cryptoAdapter: adapter,
			keyId: "test-key-1",
			context: CONTEXT,
			payload: "hello",
		});
		const expectedB64 = btoa(String.fromCharCode(...new TextEncoder().encode("hello")));
		expect(sig).toBe(`sig:test-key-1:${expectedB64}`);
	});
});

describe("syncPublicKeyToEvault", () => {
	const adapter = new TestCryptoAdapter();
	const evaultUrl = "https://evault.test";
	const eName = "w3id-123";
	const token = "bearer-token";

	beforeEach(async () => {
		await adapter.ensureKey("test-key-1", CONTEXT);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("PATCHes public key with X-ENAME and Authorization", async () => {
		let capturedUrl: string | null = null;
		let capturedInit: RequestInit | null = null;
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string | URL, init?: RequestInit) => {
				capturedUrl = typeof input === "string" ? input : input.toString();
				capturedInit = init ?? null;
				return Promise.resolve(
					new Response(
						JSON.stringify({ success: true, message: "ok" }),
						{ status: 200 },
					),
				);
			}),
		);

		await syncPublicKeyToEvault({
			evaultUrl,
			eName,
			cryptoAdapter: adapter,
			keyId: "test-key-1",
			context: CONTEXT,
			token,
		});

		expect(capturedUrl).toBe("https://evault.test/public-key");
		expect(capturedInit?.method).toBe("PATCH");
		expect((capturedInit?.headers as Record<string, string>)["X-ENAME"]).toBe(
			eName,
		);
		expect(
			(capturedInit?.headers as Record<string, string>)["Authorization"],
		).toBe("Bearer bearer-token");
		const body = JSON.parse((capturedInit?.body as string) ?? "{}");
		expect(body.publicKey).toBe("test-public-key-base64-or-multibase");
	});

	it("throws when eVault returns error", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({ error: "Invalid token" }),
						{ status: 401 },
					),
				),
			),
		);

		await expect(
			syncPublicKeyToEvault({
				evaultUrl,
				eName,
				cryptoAdapter: adapter,
				keyId: "test-key-1",
				context: CONTEXT,
				token,
			}),
		).rejects.toThrow(/Sync public key failed/);
	});
});
