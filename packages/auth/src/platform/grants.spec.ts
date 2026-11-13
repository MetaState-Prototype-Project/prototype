import { describe, expect, it } from "vitest";
import { authorize } from "./authorize.js";
import { evaluateGrants, permissionFor, type AccessGrant } from "./grants.js";
import { defaultAccessPolicy, type AccessPolicyStatement } from "./policy.js";
import type { PlatformClaim } from "./types.js";

const OWNER = "@849c0221-6f3f-55f9-95f0-f3b0d2b3092f";
const PLATFORM = "@11111111-2222-4333-8444-555555555555";

function grant(overrides: Partial<AccessGrant> = {}): AccessGrant {
	return {
		granteeType: "ename",
		granteeEName: PLATFORM,
		resourceType: "social",
		permissions: ["social:Read"],
		status: "active",
		validFrom: "2020-01-01T00:00:00.000Z",
		validUntil: null,
		...overrides,
	};
}

function claim(overrides: Partial<PlatformClaim> = {}): PlatformClaim {
	return {
		platformEname: PLATFORM,
		platformName: "Chatterbox",
		deploymentEname: "@22222222-2222-4333-8444-555555555555",
		version: "1.4.0",
		level: "L3",
		domains: ["social", "finance"],
		deployerEname: "@33333333-2222-4333-8444-555555555555",
		reviewedByEName: OWNER,
		...overrides,
	};
}

function policy(overrides: Partial<AccessPolicyStatement> = {}): AccessPolicyStatement {
	return { ...defaultAccessPolicy(OWNER), ...overrides };
}

describe("evaluateGrants", () => {
	it("permits an operation a grant covers", () => {
		expect(evaluateGrants([grant()], PLATFORM, "social", "read")).toEqual({
			allowed: true,
			reason: "granted",
		});
	});

	it("does not let a read grant authorise a write", () => {
		expect(evaluateGrants([grant()], PLATFORM, "social", "write")).toEqual({
			allowed: false,
			reason: "not-granted",
		});
	});

	it("keeps one resource's grant away from another resource", () => {
		expect(evaluateGrants([grant()], PLATFORM, "finance", "read").allowed).toBe(false);
	});

	it("keeps one platform's grant away from another platform", () => {
		expect(evaluateGrants([grant()], "@somebody-else", "social", "read").allowed).toBe(
			false,
		);
	});

	it("honours a grant made to everyone", () => {
		const open = grant({ granteeType: "public", granteeEName: null });

		expect(evaluateGrants([open], "@anyone-at-all", "social", "read").allowed).toBe(true);
	});

	it("reports a withdrawn permission as withdrawn, not as never held", () => {
		const revoked = grant({ status: "revoked" });

		expect(evaluateGrants([revoked], PLATFORM, "social", "read")).toEqual({
			allowed: false,
			reason: "revoked",
		});
	});

	it("reports a grant outside its dates as expired", () => {
		const lapsed = grant({ validUntil: "2020-06-01T00:00:00.000Z" });

		expect(evaluateGrants([lapsed], PLATFORM, "social", "read")).toEqual({
			allowed: false,
			reason: "expired",
		});
	});

	it("refuses a grant that has not started yet", () => {
		const future = grant({ validFrom: "2999-01-01T00:00:00.000Z" });

		expect(evaluateGrants([future], PLATFORM, "social", "read").reason).toBe("expired");
	});

	it("lets a live grant win over a revoked one for the same thing", () => {
		const grants = [grant({ status: "revoked" }), grant()];

		expect(evaluateGrants(grants, PLATFORM, "social", "read").allowed).toBe(true);
	});

	it("builds the permission string the ontology uses", () => {
		expect(permissionFor("finance", "write")).toBe("finance:Write");
		expect(permissionFor("social", "read")).toBe("social:Read");
	});
});

describe("authorize with grants", () => {
	it("skips the grant layer entirely when no grants are supplied", () => {
		// Omitting grants means "this caller does not use them", which must not
		// be read as "this caller holds none".
		const decision = authorize(policy(), { claim: claim(), domain: "social" });

		expect(decision.allowed).toBe(true);
	});

	it("refuses everything when the platform holds no grants", () => {
		const decision = authorize(policy(), {
			claim: claim(),
			domain: "social",
			grants: [],
		});

		expect(decision.allowed).toBe(false);
		expect(decision.code).toBe("operation-not-granted");
	});

	it("allows a read and refuses a write under a read-only grant", () => {
		const request = { claim: claim(), domain: "social", grants: [grant()] };

		expect(authorize(policy(), { ...request, operation: "read" }).allowed).toBe(true);
		const write = authorize(policy(), { ...request, operation: "write" });
		expect(write.allowed).toBe(false);
		expect(write.reason).toContain("write to your social data");
	});

	it("allows a write when the grant covers writing", () => {
		const writable = grant({ permissions: ["social:Read", "social:Write"] });

		expect(
			authorize(policy(), {
				claim: claim(),
				domain: "social",
				operation: "write",
				grants: [writable],
			}).allowed,
		).toBe(true);
	});

	it("still refuses an uncertified domain however generous the grant", () => {
		// A grant cannot widen a certificate: the association's assessment
		// decides what the release was certified for, and nothing else does.
		const generous = grant({
			resourceType: "health",
			permissions: ["health:Read", "health:Write"],
		});

		const decision = authorize(policy(), {
			claim: claim(),
			domain: "health",
			operation: "read",
			grants: [generous],
		});

		expect(decision.code).toBe("domain-not-certified");
	});

	it("still refuses a domain the owner denied however generous the grant", () => {
		const generous = grant({ permissions: ["social:Read", "social:Write"] });

		const decision = authorize(policy({ deniedDomains: ["social"] }), {
			claim: claim(),
			domain: "social",
			grants: [generous],
		});

		expect(decision.code).toBe("domain-refused-by-owner");
	});

	it("reports a withdrawn grant distinctly from one never made", () => {
		const decision = authorize(policy(), {
			claim: claim(),
			domain: "social",
			grants: [grant({ status: "revoked" })],
		});

		expect(decision.code).toBe("grant-revoked");
		expect(decision.reason).toContain("withdrawn");
	});
});
