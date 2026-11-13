import { describe, expect, it } from "vitest";
import { encodeBase58, labelledSignatureCandidates } from "./bytes.js";
import { generateKeyPair, signP256, verifyP256Detailed } from "./p256.js";

describe("verifyP256Detailed", () => {
	it("reports base64 for a base64url signature", async () => {
		const pair = await generateKeyPair();
		const signature = await signP256(pair.privateKey, "session-1");
		expect(await verifyP256Detailed(pair.publicKey, signature, "session-1")).toEqual({
			valid: true,
			encoding: "base64",
		});
	});

	it("reports base58 for a multibase signature", async () => {
		const pair = await generateKeyPair();
		const raw = Buffer.from(await signP256(pair.privateKey, "session-1"), "base64url");
		const signature = `z${encodeBase58(Uint8Array.from(raw))}`;
		expect(await verifyP256Detailed(pair.publicKey, signature, "session-1")).toEqual({
			valid: true,
			encoding: "base58",
		});
	});

	it("still reports base64 for a base64 signature that happens to start with z", async () => {
		const pair = await generateKeyPair();
		let signature = "";
		let payload = "";
		for (let i = 0; !signature.startsWith("z"); i += 1) {
			payload = `session-${i}`;
			signature = await signP256(pair.privateKey, payload);
		}
		expect(labelledSignatureCandidates(signature)[0]?.encoding).toBe("base64");
		expect(await verifyP256Detailed(pair.publicKey, signature, payload)).toEqual({
			valid: true,
			encoding: "base64",
		});
	});

	it("rejects a signature over a different payload", async () => {
		const pair = await generateKeyPair();
		const signature = await signP256(pair.privateKey, "session-1");
		expect(await verifyP256Detailed(pair.publicKey, signature, "session-2")).toEqual({
			valid: false,
		});
	});
});
