/**
 * Assembles real evidence for a real deployment, and verifies it.
 *
 * Nothing here is manufactured. The deployment profile and the certificate come
 * from the awareness network, the binding documents from the deployment's own
 * eVault, and the release proof from the platform's profile. The only thing the
 * verifier cannot obtain by reading is the deployment's private key, which is
 * the point of the possession link.
 */

import {
	answerChallenge,
	verifyDeploymentChain,
	type ChainResult,
	type DeploymentEvidence,
	type HandshakeChallenge,
} from "@metastate-foundation/auth/platform";
import { randomUUID } from "node:crypto";
import { verifySignature } from "signature-validator/src/index";
import { accreditations, deployments, platformProfile } from "./aaas";
import { bindingDocuments } from "./evault";
import { registryUrl } from "./env";
import type { AccreditationRecord, DeploymentRecord } from "./ontology";

/**
 * Wallet signatures are resolved through the registry, the same way every other
 * service in the network checks one.
 */
async function verifyWalletSignature(
	signer: string,
	signature: string,
	payload: string,
): Promise<boolean> {
	try {
		const result = await verifySignature({
			eName: signer,
			signature,
			payload,
			registryBaseUrl: registryUrl(),
		});
		return result.valid === true;
	} catch {
		return false;
	}
}

export interface AssembledEvidence {
	evidence: DeploymentEvidence | null;
	/** What could not be found, in words, when evidence is incomplete. */
	missing: string[];
	accreditation: AccreditationRecord | null;
	deployment: DeploymentRecord;
}

/** The decision in force for one platform release: newest record wins. */
export function accreditationFor(
	records: AccreditationRecord[],
	platformEname: string,
	version: string,
): AccreditationRecord | null {
	return (
		records.find(
			(record) =>
				record.platformEName === platformEname &&
				record.platformVersion === version,
		) ?? null
	);
}

export async function assemble(
	deployment: DeploymentRecord,
): Promise<AssembledEvidence> {
	const missing: string[] = [];
	const [records, profile, docs] = await Promise.all([
		accreditations(),
		platformProfile(deployment.platformEname),
		bindingDocuments(deployment.deploymentEname),
	]);

	const accreditation = accreditationFor(
		records,
		deployment.platformEname,
		deployment.version,
	);
	if (!accreditation) {
		missing.push(`no certification decision for version ${deployment.version}`);
	}

	const keyDoc = docs.find((doc) => doc.type === "deployment_key");
	const versionDoc = docs.find((doc) => doc.type === "software_version");
	if (!keyDoc) missing.push("the deployment's key document is not readable");
	if (!versionDoc) missing.push("the deployment's release document is not readable");

	// The platform profile carries its LATEST release proof, but a deployment
	// may be running an older one, so match on the version actually deployed
	// rather than taking whatever is current.
	const proof = profile?.proofs.filter(
		(entry) => entry?.statement?.version === deployment.version,
	).at(-1);
	if (!proof) {
		missing.push(`no signed release proof for version ${deployment.version}`);
	}

	if (!accreditation || !keyDoc || !versionDoc || !proof) {
		return { evidence: null, missing, accreditation, deployment };
	}

	return {
		missing,
		accreditation,
		deployment,
		evidence: {
			deploymentEname: deployment.deploymentEname,
			deploymentName: deployment.deploymentName,
			environment: deployment.environment,
			deployerEname: deployment.deployerEname,
			platformEname: deployment.platformEname,
			versionEname: deployment.versionEname,
			version: deployment.version,
			releaseTag: deployment.releaseTag,
			commitSha: deployment.commitSha,
			publicKey: deployment.publicKey,
			deploymentKeyDocument: keyDoc as never,
			softwareVersionDocument: versionDoc as never,
			accreditationJws: accreditation.jws,
			issuerJwksUri: accreditation.issuerJwksUri,
			submissionProof: proof as never,
		},
	};
}

export function challengeFor(audience: string): HandshakeChallenge {
	const now = Date.now();
	return {
		nonce: randomUUID(),
		audience,
		issuedAt: new Date(now).toISOString(),
		expiresAt: new Date(now + 120_000).toISOString(),
	};
}

/**
 * Verifies a deployment's chain.
 *
 * When the operator has supplied that deployment's private key, the challenge
 * is answered for real and all six links are checked. Without it the signature
 * is one this app makes with a throwaway key: possession then fails, correctly,
 * and the remaining five links are still checked against real evidence.
 */
export async function verify(
	evidence: DeploymentEvidence,
	audience: string,
	privateKey: string | null,
): Promise<{ chain: ChainResult; possessionProven: boolean }> {
	const challenge = challengeFor(audience);
	const response = privateKey
		? await answerChallenge({ evidence, privateKey }, challenge)
		: { challenge, evidence, signature: "" };

	const chain = await verifyDeploymentChain(response, {
		audience,
		registryBaseUrl: registryUrl(),
		verifyWalletSignature,
	});

	// With no key there was nothing to check, which is not the same as a check
	// that failed. Saying "the signature did not verify" would suggest the
	// deployment presented something wrong rather than that we never asked it.
	if (!privateKey) {
		const possession = chain.links.find((link) => link.id === "possession");
		if (possession) {
			possession.detail =
				"Not attempted — this is a reader, not the deployment, so it holds no key to answer with.";
		}
	}

	return { chain, possessionProven: Boolean(privateKey) };
}

/** Deployments grouped under the platform they belong to. */
export async function network(): Promise<
	Map<string, { platform: string; deployments: DeploymentRecord[] }>
> {
	const all = await deployments();
	const byPlatform = new Map<
		string,
		{ platform: string; deployments: DeploymentRecord[] }
	>();
	for (const deployment of all) {
		const entry = byPlatform.get(deployment.platformEname) ?? {
			platform: deployment.platformEname,
			deployments: [],
		};
		entry.deployments.push(deployment);
		byPlatform.set(deployment.platformEname, entry);
	}
	return byPlatform;
}
