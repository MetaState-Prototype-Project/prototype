import { describe, expect, it, vi } from "vitest";
import type { CryptoAdapter } from "./crypto-adapter.js";
import { syncPublicKeyToEvault } from "./sync-public-key.js";

function createFakeAdapter(publicKey = "zFakePublicKey"): CryptoAdapter {
	return {
		async getPublicKey() {
			return publicKey;
		},
		async signPayload() {
			return "fakeSignature";
		},
		async ensureKey() {
			return { created: false };
		},
	};
}

describe("syncPublicKeyToEvault", () => {
	it("fetches whois then PATCHes public-key", async () => {
		const fetchMock = vi.fn();
		fetchMock
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ keyBindingCertificates: [] }),
			})
			.mockResolvedValueOnce({ ok: true });
		vi.stubGlobal("fetch", fetchMock);

		const adapter = createFakeAdapter("zMyKey");
		await syncPublicKeyToEvault(adapter, {
			evaultUri: "https://evault.example",
			eName: "ename:test",
			context: "onboarding",
		});

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(fetchMock).toHaveBeenNthCalledWith(
			1,
			"https://evault.example/whois",
			expect.objectContaining({
				headers: { "X-ENAME": "ename:test" },
			}),
		);
		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://evault.example/public-key",
			expect.objectContaining({
				method: "PATCH",
				headers: {
					"X-ENAME": "ename:test",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ publicKey: "zMyKey" }),
			}),
		);

		vi.unstubAllGlobals();
	});

	it("includes Authorization when authToken provided", async () => {
		const fetchMock = vi.fn();
		fetchMock
			.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ keyBindingCertificates: [] }),
			})
			.mockResolvedValueOnce({ ok: true });
		vi.stubGlobal("fetch", fetchMock);

		const adapter = createFakeAdapter();
		await syncPublicKeyToEvault(adapter, {
			evaultUri: "https://evault.example",
			eName: "e",
			context: "onboarding",
			authToken: "bearer-token",
		});

		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://evault.example/public-key",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer bearer-token",
				}),
			}),
		);

		vi.unstubAllGlobals();
	});

	it("throws when adapter returns no public key", async () => {
		const adapter = createFakeAdapter();
		vi.spyOn(adapter, "getPublicKey").mockResolvedValue(undefined);

		const fetchMock = vi.fn().mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({}),
		});
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			syncPublicKeyToEvault(adapter, {
				evaultUri: "https://evault.example",
				eName: "e",
				context: "onboarding",
			}),
		).rejects.toThrow("No public key");

		vi.unstubAllGlobals();
	});
});
