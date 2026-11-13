import { describe, expect, it } from "vitest";
import { authorize, permittedDomains } from "./authorize.js";
import {
	accessPolicyPayload,
	defaultAccessPolicy,
	parseAccessPolicy,
	verifyAccessPolicy,
	type AccessPolicyStatement,
} from "./policy.js";
import { generateKeyPair, signP256, verifyP256 } from "./p256.js";
import type { PlatformClaim } from "./types.js";

const OWNER = "@849c0221-6f3f-55f9-95f0-f3b0d2b3092f";

function claim(overrides: Partial<PlatformClaim> = {}): PlatformClaim {
	return {
		platformEname: "@11111111-2222-4333-8444-555555555555",
		platformName: "Chatterbox",
		deploymentEname: "@22222222-2222-4333-8444-555555555555",
		version: "1.4.0",
		level: "L3",
		domains: ["social", "communication"],
		deployerEname: "@33333333-2222-4333-8444-555555555555",
		reviewedByEName: OWNER,
		...overrides,
	};
}

function policy(overrides: Partial<AccessPolicyStatement> = {}): AccessPolicyStatement {
	return { ...defaultAccessPolicy(OWNER), ...overrides };
}

describe("authorize", () => {
	it("lets a certified platform reach a domain it was certified for", () => {
		const decision = authorize(policy(), { claim: claim(), domain: "social" });

		expect(decision.allowed).toBe(true);
		expect(decision.code).toBe("granted");
	});

	it("stops a social platform reaching finance data", () => {
		const decision = authorize(policy(), { claim: claim(), domain: "finance" });

		expect(decision.allowed).toBe(false);
		expect(decision.code).toBe("domain-not-certified");
		expect(decision.reason).toContain("not certified for finance");
	});

	it("stops it even when the owner has permitted finance to others", () => {
		const decision = authorize(
			policy({ allowedDomains: ["social", "communication", "finance"] }),
			{ claim: claim(), domain: "finance" },
		);

		// The owner's permission cannot widen a certificate; only the
		// association's assessment decides what a release was certified for.
		expect(decision.code).toBe("domain-not-certified");
	});

	it("honours a domain the owner refuses outright", () => {
		const decision = authorize(policy({ deniedDomains: ["communication"] }), {
			claim: claim(),
			domain: "communication",
		});

		expect(decision.code).toBe("domain-refused-by-owner");
	});

	it("honours an owner allowlist narrower than the certificate", () => {
		const decision = authorize(policy({ allowedDomains: ["social"] }), {
			claim: claim(),
			domain: "communication",
		});

		expect(decision.code).toBe("domain-outside-owner-allowlist");
	});

	it("refuses a platform certified below the level the owner asked for", () => {
		const decision = authorize(policy({ minimumLevel: "L4" }), {
			claim: claim({ level: "L3" }),
			domain: "social",
		});

		expect(decision.code).toBe("level-below-policy");
		expect(decision.reason).toContain("L3");
	});

	it("accepts a platform certified above the level the owner asked for", () => {
		const decision = authorize(policy({ minimumLevel: "L2" }), {
			claim: claim({ level: "L5" }),
			domain: "social",
		});

		expect(decision.allowed).toBe(true);
	});

	it("ignores a reputation score from an engine the owner did not name", () => {
		const decision = authorize(
			policy({
				reputationEngine: "@ereputation",
				minimumReputation: 40,
			}),
			{
				claim: claim(),
				domain: "social",
				reputation: { engine: "@some-other-engine", score: 99 },
			},
		);

		expect(decision.code).toBe("reputation-engine-not-accepted");
	});

	it("refuses a platform scoring below the owner's threshold", () => {
		const decision = authorize(
			policy({ reputationEngine: "@ereputation", minimumReputation: 40 }),
			{
				claim: claim(),
				domain: "social",
				reputation: { engine: "@ereputation", score: 12 },
			},
		);

		expect(decision.code).toBe("reputation-below-policy");
	});

	it("accepts a platform meeting the owner's reputation threshold", () => {
		const decision = authorize(
			policy({ reputationEngine: "@ereputation", minimumReputation: 40 }),
			{
				claim: claim(),
				domain: "social",
				reputation: { engine: "@ereputation", score: 40 },
			},
		);

		expect(decision.allowed).toBe(true);
	});

	it("ignores reputation entirely when the owner set no threshold", () => {
		const decision = authorize(policy({ reputationEngine: "@ereputation" }), {
			claim: claim(),
			domain: "social",
			reputation: null,
		});

		expect(decision.allowed).toBe(true);
	});

	it("lists what a platform can reach, for showing an owner up front", () => {
		expect(
			permittedDomains(policy({ deniedDomains: ["communication"] }), claim()),
		).toEqual(["social"]);
	});
});

describe("access policy statements", () => {
	it("verifies a policy the owner signed over their own vault", async () => {
		const key = await generateKeyPair();
		const statement = policy({ minimumLevel: "L4", issuedAt: new Date().toISOString() });
		const payload = accessPolicyPayload(statement);

		const ok = await verifyAccessPolicy(
			{
				statement,
				payload,
				signature: await signP256(key.privateKey, payload),
				signer: OWNER,
			},
			(_signer, signature, signed) =>
				verifyP256(key.publicKey, signature, signed),
		);

		expect(ok).toBe(true);
	});

	it("refuses a policy signed by someone other than the vault owner", async () => {
		const key = await generateKeyPair();
		const statement = policy();
		const payload = accessPolicyPayload(statement);

		const ok = await verifyAccessPolicy(
			{
				statement,
				payload,
				signature: await signP256(key.privateKey, payload),
				signer: "@someone-else",
			},
			(_signer, signature, signed) =>
				verifyP256(key.publicKey, signature, signed),
		);

		expect(ok).toBe(false);
	});

	it("refuses a policy whose terms were edited after signing", async () => {
		const key = await generateKeyPair();
		const statement = policy({ minimumLevel: "L4" });
		const payload = accessPolicyPayload(statement);
		const signature = await signP256(key.privateKey, payload);

		const ok = await verifyAccessPolicy(
			{
				statement: { ...statement, minimumLevel: "L0" },
				payload,
				signature,
				signer: OWNER,
			},
			(_signer, sig, signed) => verifyP256(key.publicKey, sig, signed),
		);

		expect(ok).toBe(false);
	});

	it("rejects a statement that is not a policy at all", () => {
		expect(parseAccessPolicy({ type: "something-else" })).toBeNull();
		expect(parseAccessPolicy({ ...policy(), minimumLevel: "L9" })).toBeNull();
		expect(parseAccessPolicy({ ...policy(), subject: "no-at-sign" })).toBeNull();
	});
});
