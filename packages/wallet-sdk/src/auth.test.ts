import { describe, expect, it, vi } from "vitest";
import type { CryptoAdapter } from "./crypto-adapter.js";
import { authenticate } from "./auth.js";

function createFakeAdapter(signResult = "sig123"): CryptoAdapter {
	return {
		async getPublicKey() {
			return "zFakePublicKey";
		},
		async signPayload(_keyId, _context, payload) {
			return `${signResult}:${payload}`;
		},
		async ensureKey() {
			return { created: false };
		},
	};
}

describe("authenticate", () => {
	it("calls ensureKey then signPayload and returns signature", async () => {
		const adapter = createFakeAdapter("mySig");
		const ensureSpy = vi.spyOn(adapter, "ensureKey");
		const signSpy = vi.spyOn(adapter, "signPayload");

		const result = await authenticate(adapter, {
			sessionId: "session-abc",
			context: "onboarding",
		});

		expect(result).toEqual({ signature: "mySig:session-abc" });
		expect(ensureSpy).toHaveBeenCalledWith("default", "onboarding");
		expect(signSpy).toHaveBeenCalledWith(
			"default",
			"onboarding",
			"session-abc",
		);
	});

	it("uses custom keyId when provided", async () => {
		const adapter = createFakeAdapter();
		const ensureSpy = vi.spyOn(adapter, "ensureKey");

		await authenticate(adapter, {
			sessionId: "s",
			keyId: "custom-key",
			context: "pre-verification",
		});

		expect(ensureSpy).toHaveBeenCalledWith("custom-key", "pre-verification");
	});
});
