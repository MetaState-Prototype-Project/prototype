/**
 * The demonstrator's world: two deployments, one vault, one owner.
 *
 * Everything here is genuine cryptography checked by the real PP Auth
 * verifier. What is simulated is the *setting*, not the mechanism: the keys
 * standing in for the deployer's wallet, the registry and the association are
 * generated in this process rather than held by those parties, so the
 * demonstrator can run on a laptop with nothing else switched on.
 *
 * State is anchored on globalThis because Vite's dev server evaluates a module
 * once per import graph, and a world that exists twice would issue challenges
 * from one copy and try to redeem them in the other.
 */

import {
	accessPolicyPayload,
	createChallengeStore,
	defaultAccessPolicy,
	generateKeyPair,
	signP256,
	verifyP256,
	type AccessPolicyStatement,
	type ChallengeStore,
	type DeploymentIdentity,
	type SignedAccessPolicy,
} from "@metastate-foundation/auth/platform";
// Minting evidence from local keys is a demonstration and test facility. It is
// deliberately a separate entry point so it can never be reached by accident
// from code that verifies real deployments.
import {
	createTrustRoots,
	mintDeployment,
	type TrustRoots,
} from "@metastate-foundation/auth/platform/scenario";
import { createLocalJWKSet } from "jose";

/** The person whose eVault the demonstration is about. */
export const OWNER_ENAME = "@849c0221-6f3f-55f9-95f0-f3b0d2b3092f";

export const ISSUER_JWKS_URI = "demo://association/.well-known/jwks.json";
export const REGISTRY_JWKS_URI = "demo://registry/.well-known/jwks.json";
export const REPUTATION_ENGINE = "@ereputation.w3ds";

export interface VaultRecord {
	id: string;
	domain: string;
	kind: string;
	body: string;
	writtenBy: string;
	at: string;
}

export interface AttemptLog {
	id: string;
	at: string;
	deploymentId: string;
	deploymentName: string;
	domain: string;
	allowed: boolean;
	reason: string;
	code: string;
}

export interface DemoDeployment {
	id: string;
	/** How the platform describes itself, for the card. */
	blurb: string;
	identity: DeploymentIdentity;
	/** Set when the operator has tampered with the evidence, so the UI can say so. */
	tampered: string | null;
	pristine: DeploymentIdentity;
}

export interface World {
	roots: TrustRoots;
	challenges: ChallengeStore;
	deployments: Map<string, DemoDeployment>;
	records: VaultRecord[];
	attempts: AttemptLog[];
	policy: SignedAccessPolicy;
	ownerKey: { publicKey: string; privateKey: string };
	/** Reputation the demo's engine reports, keyed by platform eName. */
	reputation: Map<string, number>;
	resolveJwks: (uri: string) => ReturnType<typeof createLocalJWKSet>;
}

const KEY = Symbol.for("pp-auth-demo.world");
const store = globalThis as typeof globalThis & { [KEY]?: Promise<World> };

const CHATTERBOX = "@11111111-1111-4111-8111-111111111111";
const LEDGERLY = "@22222222-2222-4222-8222-222222222222";

export async function signPolicy(
	statement: AccessPolicyStatement,
	ownerKey: { privateKey: string },
): Promise<SignedAccessPolicy> {
	const payload = accessPolicyPayload(statement);
	return {
		statement,
		payload,
		signature: await signP256(ownerKey.privateKey, payload),
		signer: statement.subject,
	};
}

async function build(): Promise<World> {
	const deployerEname = "@d0000000-0000-4000-8000-00000000dep1";
	const roots = await createTrustRoots(deployerEname);
	const registryKeys = createLocalJWKSet(roots.registry.jwks);
	const associationKeys = createLocalJWKSet(roots.association.jwks);

	const shared = {
		issuerJwksUri: ISSUER_JWKS_URI,
		registryJwksUri: REGISTRY_JWKS_URI,
		reviewedByEName: OWNER_ENAME,
	};

	const [chatterbox, ledgerly] = await Promise.all([
		mintDeployment(roots, {
			...shared,
			platformEname: CHATTERBOX,
			platformName: "Chatterbox",
			deploymentName: "chatterbox-eu",
			environment: "production",
			version: "1.4.0",
			releaseTag: "v1.4.0",
			commitSha: "4f9c1a77b2e3d5086a1c9f2b3d4e5f60718293a4",
			repository: "https://gitw3.example/acme/chatterbox",
			requestedDomains: ["social", "communication"],
			level: "L3",
		}),
		mintDeployment(roots, {
			...shared,
			platformEname: LEDGERLY,
			platformName: "Ledgerly",
			deploymentName: "ledgerly-eu",
			environment: "production",
			version: "2.1.3",
			releaseTag: "v2.1.3",
			commitSha: "9b1e2d3c4a5f60718293a4b5c6d7e8f90a1b2c3d",
			repository: "https://gitw3.example/acme/ledgerly",
			requestedDomains: ["finance"],
			level: "L4",
		}),
	]);

	const deployments = new Map<string, DemoDeployment>([
		[
			"chatterbox",
			{
				id: "chatterbox",
				blurb: "A social platform. Posts, feeds, and direct messages.",
				identity: chatterbox.identity,
				pristine: structuredClone(chatterbox.identity),
				tampered: null,
			},
		],
		[
			"ledgerly",
			{
				id: "ledgerly",
				blurb: "A finance platform. Accounts, ledgers, and payments.",
				identity: ledgerly.identity,
				pristine: structuredClone(ledgerly.identity),
				tampered: null,
			},
		],
	]);

	const ownerKey = await generateKeyPair();
	const policy = await signPolicy(
		{
			...defaultAccessPolicy(OWNER_ENAME),
			minimumLevel: "L2",
			issuedAt: new Date().toISOString(),
			nonce: "initial",
		},
		ownerKey,
	);

	return {
		roots,
		challenges: createChallengeStore(),
		deployments,
		records: seedRecords(),
		attempts: [],
		policy,
		ownerKey,
		reputation: new Map([
			[CHATTERBOX, 62],
			[LEDGERLY, 31],
		]),
		resolveJwks: (uri) =>
			uri === ISSUER_JWKS_URI ? associationKeys : registryKeys,
	};
}

function seedRecords(): VaultRecord[] {
	const at = new Date().toISOString();
	return [
		{
			id: "seed-social",
			domain: "social",
			kind: "Social media post",
			body: "Spent the morning on the allotment. Tomatoes finally coming through.",
			writtenBy: OWNER_ENAME,
			at,
		},
		{
			id: "seed-finance",
			domain: "finance",
			kind: "Account",
			body: "Current account · balance £4,182.60 · sort 04-00-04",
			writtenBy: OWNER_ENAME,
			at,
		},
		{
			id: "seed-comms",
			domain: "communication",
			kind: "Message",
			body: "Are we still on for Thursday?",
			writtenBy: OWNER_ENAME,
			at,
		},
	];
}

export function world(): Promise<World> {
	if (!store[KEY]) store[KEY] = build();
	return store[KEY];
}

/** Verifies a signature made by the demo owner's stand-in wallet. */
export async function verifyOwnerSignature(
	current: World,
	signature: string,
	payload: string,
): Promise<boolean> {
	return verifyP256(current.ownerKey.publicKey, signature, payload);
}

export async function resetWorld(): Promise<World> {
	store[KEY] = build();
	return store[KEY];
}
