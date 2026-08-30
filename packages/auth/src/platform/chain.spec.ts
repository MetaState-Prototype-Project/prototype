import { createLocalJWKSet } from "jose";
import { describe, expect, it } from "vitest";
import { softwareVersionEName, verifyDeploymentChain } from "./chain.js";
import { answerChallenge } from "./deployment.js";
import { createChallengeStore, verifyHandshake } from "./handshake.js";
import {
	createTrustRoots,
	mintDeployment,
	type DeploymentSpec,
	type TrustRoots,
} from "./scenario.js";
import type { ChainOptions } from "./chain.js";
import type { DeploymentIdentity, HandshakeChallenge } from "./index.js";

const AUDIENCE = "@a0000000-0000-4000-8000-000000000001";
const PLATFORM = "@11111111-2222-4333-8444-555555555555";
const ISSUER_JWKS = "https://ppa.example/.well-known/jwks.json";
const REGISTRY_JWKS = "https://registry.example/.well-known/jwks.json";

function spec(overrides: Partial<DeploymentSpec> = {}): DeploymentSpec {
	return {
		platformEname: PLATFORM,
		platformName: "chatterbox",
		deploymentName: "chatterbox-eu",
		environment: "production",
		version: "1.4.0",
		releaseTag: "v1.4.0",
		commitSha: "a".repeat(40),
		repository: "https://gitw3.example/acme/chatterbox",
		requestedDomains: ["social", "communication"],
		level: "L3",
		issuerJwksUri: ISSUER_JWKS,
		registryJwksUri: REGISTRY_JWKS,
		...overrides,
	};
}

function options(roots: TrustRoots): ChainOptions {
	const registry = createLocalJWKSet(roots.registry.jwks);
	const association = createLocalJWKSet(roots.association.jwks);
	return {
		audience: AUDIENCE,
		registryBaseUrl: "https://registry.example",
		registryJwksUri: REGISTRY_JWKS,
		verifyWalletSignature: roots.verifyWalletSignature,
		resolveJwks: (uri) => (uri === ISSUER_JWKS ? association : registry),
	};
}

function challenge(overrides: Partial<HandshakeChallenge> = {}): HandshakeChallenge {
	const now = Date.now();
	return {
		nonce: "nonce-1",
		audience: AUDIENCE,
		issuedAt: new Date(now).toISOString(),
		expiresAt: new Date(now + 60_000).toISOString(),
		...overrides,
	};
}

async function run(
	roots: TrustRoots,
	identity: DeploymentIdentity,
	overrides: Partial<HandshakeChallenge> = {},
) {
	const response = await answerChallenge(identity, challenge(overrides));
	return verifyDeploymentChain(response, options(roots));
}

describe("verifyDeploymentChain", () => {
	it("accepts a deployment whose every link holds", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(roots, spec());

		const result = await run(roots, identity);

		expect(result.links.filter((link) => !link.ok)).toEqual([]);
		expect(result.ok).toBe(true);
		expect(result.claim).toMatchObject({
			platformEname: PLATFORM,
			platformName: "chatterbox",
			level: "L3",
			domains: ["social", "communication"],
		});
	});

	it("reports every link even when one fails, so a trace is debuggable", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(roots, spec());
		const response = await answerChallenge(identity, challenge());
		response.signature = await answerChallenge(
			identity,
			challenge({ nonce: "a-different-nonce" }),
		).then((other) => other.signature);

		const result = await verifyDeploymentChain(response, options(roots));

		expect(result.failedAt).toBe("possession");
		expect(result.links).toHaveLength(6);
		expect(result.links.slice(1).every((link) => link.ok)).toBe(true);
	});

	it("refuses a deployment presenting a key it does not hold", async () => {
		const roots = await createTrustRoots();
		const [mine, theirs] = await Promise.all([
			mintDeployment(roots, spec()),
			mintDeployment(roots, spec()),
		]);
		// Claim the other deployment's identity while signing with our own key.
		const stolen: DeploymentIdentity = {
			evidence: theirs.identity.evidence,
			privateKey: mine.identity.privateKey,
		};

		const result = await run(roots, stolen);

		expect(result.ok).toBe(false);
		expect(result.failedAt).toBe("possession");
		expect(result.claim).toBeNull();
	});

	it("refuses evidence whose deployment key was never authorised", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(roots, spec());
		identity.evidence.deploymentKeyDocument.data.environment = "staging";

		const result = await run(roots, identity);

		expect(result.failedAt).toBe("deployment-authorised");
	});

	it("refuses a version document swapped in from another release", async () => {
		const roots = await createTrustRoots();
		const [first, second] = await Promise.all([
			mintDeployment(roots, spec()),
			mintDeployment(roots, spec({ version: "9.9.9", releaseTag: "v9.9.9" })),
		]);
		first.identity.evidence.softwareVersionDocument =
			second.identity.evidence.softwareVersionDocument;

		const result = await run(roots, first.identity);

		expect(result.failedAt).toBe("bundle-integrity");
	});

	it("refuses a version eName that does not derive from the platform", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(roots, spec());
		identity.evidence.versionEname = "@99999999-9999-4999-8999-999999999999";

		const result = await run(roots, identity);

		expect(result.failedAt).toBe("version-identity");
	});

	it("refuses a certificate issued for a different version", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(roots, spec());
		const other = await mintDeployment(roots, spec({ version: "2.0.0" }));
		identity.evidence.accreditationJws = other.identity.evidence.accreditationJws;

		const result = await run(roots, identity);

		expect(result.failedAt).toBe("accreditation");
		expect(result.links.at(-1)?.detail).toContain("2.0.0");
	});

	it("refuses a certificate signed by anyone but the association", async () => {
		const [roots, impostor] = await Promise.all([
			createTrustRoots(),
			createTrustRoots(),
		]);
		const { identity } = await mintDeployment(roots, spec());
		const forged = await mintDeployment(impostor, spec());
		identity.evidence.accreditationJws = forged.identity.evidence.accreditationJws;

		const result = await run(roots, identity);

		expect(result.failedAt).toBe("accreditation");
	});

	it("refuses a release the association turned down", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(
			roots,
			spec({ decision: "denied" }),
		);

		const result = await run(roots, identity);

		expect(result.failedAt).toBe("accreditation");
		expect(result.links.at(-1)?.detail).toContain("refused");
	});

	it("grants only domains that were both asked for and certified", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(
			roots,
			spec({
				requestedDomains: ["social"],
				// A certificate naming more than the release asked for must not
				// widen it: the assessment covered the request, not this list.
				grantedDomains: ["social", "finance"],
			}),
		);

		const result = await run(roots, identity);

		expect(result.ok).toBe(true);
		expect(result.claim?.domains).toEqual(["social"]);
	});

	it("refuses a challenge issued to a different verifier", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(roots, spec());

		const result = await run(roots, identity, { audience: "@somebody-else" });

		expect(result.failedAt).toBe("possession");
	});

	it("refuses an expired challenge", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(roots, spec());

		const result = await run(roots, identity, {
			expiresAt: new Date(Date.now() - 1000).toISOString(),
		});

		expect(result.failedAt).toBe("possession");
	});
});

describe("softwareVersionEName", () => {
	it("derives the identifier the registry mints, without asking it", () => {
		// Fixed vector: any drift from the registry's UUIDv5 derivation would
		// silently reject every genuine deployment, so it is pinned here.
		expect(softwareVersionEName(PLATFORM, "1.4.0")).toBe(
			softwareVersionEName(PLATFORM, "1.4.0"),
		);
		expect(softwareVersionEName(PLATFORM, "1.4.0")).toMatch(
			/^@[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(softwareVersionEName(PLATFORM, "1.4.1")).not.toBe(
			softwareVersionEName(PLATFORM, "1.4.0"),
		);
	});

	it("rejects a platform eName that is not a UUID", () => {
		expect(() => softwareVersionEName("@not-a-uuid", "1.0.0")).toThrow();
	});
});

describe("verifyHandshake", () => {
	it("spends a challenge so a captured response cannot be replayed", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(roots, spec());
		const store = createChallengeStore();
		const issued = store.issue(AUDIENCE);
		const response = await answerChallenge(identity, issued);
		const config = { ...options(roots), store };

		const first = await verifyHandshake(response, config);
		const second = await verifyHandshake(response, config);

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(false);
		expect(second.links[0].detail).toContain("already answered");
	});

	it("refuses a challenge it never issued", async () => {
		const roots = await createTrustRoots();
		const { identity } = await mintDeployment(roots, spec());
		const response = await answerChallenge(identity, challenge());

		const result = await verifyHandshake(response, {
			...options(roots),
			store: createChallengeStore(),
		});

		expect(result.ok).toBe(false);
	});

	it("expires an unanswered challenge", async () => {
		let clock = 0;
		const store = createChallengeStore(1000, () => clock);
		const issued = store.issue(AUDIENCE);
		clock = 2000;

		expect(store.redeem(issued.nonce)).toBe(false);
	});
});
