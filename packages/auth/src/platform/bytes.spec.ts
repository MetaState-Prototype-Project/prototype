import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalSubmissionStatement, stableStringify } from "./bytes.js";

/**
 * A real release proof, read from congo-basin's live platform profile on
 * 2026-08-30. The payload is what the author's wallet actually signed, so this
 * is a known-good vector rather than a value this codebase produced: if the
 * canonical form drifts, this test fails and every genuine release would
 * otherwise have been silently rejected.
 */
const REAL_STATEMENT = {
	type: "w3ds.ppa.release-submission",
	nonce: "7GaaGUA1pBOGkPj57hmdzQ",
	domains: ["social", "finance", "media"],
	version: "1.1.0",
	issuedAt: "2026-08-29T17:58:43Z",
	releaseTag: "v1.1.0",
	repository: "849c0221-6f3f-55f9-95f0-f3b0d2b3092f/congo-basin",
	signerEName: "@849c0221-6f3f-55f9-95f0-f3b0d2b3092f",
	platformName: "congo-basin",
	repositoryId: 2,
	platformEName: "@00c41b0b-4a35-574f-b502-d90377f00f44",
	schemaVersion: 1,
	manifestCommitId: "39aa01cbf5ee511eb3ea74f005a2246deb522688",
};
const REAL_PAYLOAD =
	"gitw3:ppa:v1:vst5thDbtMeYQ5fWGM4recrBMvFWEYVRPqQ2J4C4qiM";

function payloadFor(statement: Record<string, unknown>): string {
	return (
		"gitw3:ppa:v1:" +
		createHash("sha256")
			.update(canonicalSubmissionStatement(statement))
			.digest("base64url")
	);
}

describe("canonicalSubmissionStatement", () => {
	it("reproduces the payload a real wallet signed", () => {
		expect(payloadFor(REAL_STATEMENT)).toBe(REAL_PAYLOAD);
	});

	it("is unaffected by the key order a statement arrives in", () => {
		// A statement that has been through an eVault and the awareness fanout
		// comes back with its keys reordered. That must not change the digest.
		const shuffled = Object.fromEntries(
			Object.entries(REAL_STATEMENT).sort(([a], [b]) => a.localeCompare(b)),
		);

		expect(payloadFor(shuffled)).toBe(REAL_PAYLOAD);
	});

	it("does not accept the wire order or sorted order as canonical", () => {
		// Both of these were tried against live proofs and neither matches, so
		// they are pinned as wrong rather than left as plausible alternatives.
		const wire = "gitw3:ppa:v1:" + createHash("sha256")
			.update(JSON.stringify(REAL_STATEMENT))
			.digest("base64url");
		const sorted = "gitw3:ppa:v1:" + createHash("sha256")
			.update(stableStringify(REAL_STATEMENT))
			.digest("base64url");

		expect(wire).not.toBe(REAL_PAYLOAD);
		expect(sorted).not.toBe(REAL_PAYLOAD);
	});

	it("changes when any signed field changes", () => {
		expect(payloadFor({ ...REAL_STATEMENT, version: "1.1.1" })).not.toBe(
			REAL_PAYLOAD,
		);
		expect(
			payloadFor({ ...REAL_STATEMENT, domains: ["social", "finance"] }),
		).not.toBe(REAL_PAYLOAD);
	});
});
