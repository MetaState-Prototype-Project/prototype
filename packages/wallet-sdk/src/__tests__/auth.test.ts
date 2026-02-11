import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "../auth.js";
import { TestCryptoAdapter } from "./TestCryptoAdapter.js";

describe("authenticate", () => {
	const adapter = new TestCryptoAdapter();
	const CONTEXT = "onboarding";

	beforeEach(async () => {
		await adapter.ensureKey("default", CONTEXT);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns signature from adapter", async () => {
		const result = await authenticate(adapter, {
			sessionId: "sess-123",
			keyId: "default",
			context: CONTEXT,
		});
		expect(result.signature).toMatch(/^sig:default:/);
		const b64 = result.signature.replace(/^sig:default:/, "");
		expect(atob(b64)).toBe("sess-123");
	});

	it("uses custom keyId when provided", async () => {
		await adapter.ensureKey("test-key-1", CONTEXT);
		const result = await authenticate(adapter, {
			sessionId: "hello",
			keyId: "test-key-1",
			context: CONTEXT,
		});
		expect(result.signature).toMatch(/^sig:test-key-1:/);
	});
});
