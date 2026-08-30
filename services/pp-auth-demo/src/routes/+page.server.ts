import { DOMAINS } from "$lib/domains";
import { OWNER_ENAME, REPUTATION_ENGINE, world } from "$lib/server/world";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const current = await world();

	const deployments = [...current.deployments.values()].map((deployment) => {
		const evidence = deployment.identity.evidence;
		return {
			id: deployment.id,
			blurb: deployment.blurb,
			name: evidence.deploymentName,
			platformName: evidence.submissionProof.statement.platformName,
			platformEname: evidence.platformEname,
			deploymentEname: evidence.deploymentEname,
			environment: evidence.environment,
			version: evidence.version,
			releaseTag: evidence.releaseTag,
			commitSha: evidence.commitSha,
			publicKey: evidence.publicKey,
			deployerEname: evidence.deployerEname,
			certifiedDomains: evidence.submissionProof.statement.domains,
			repository: evidence.submissionProof.statement.repository,
			reputation: current.reputation.get(evidence.platformEname) ?? null,
			tampered: deployment.tampered,
		};
	});

	return {
		owner: OWNER_ENAME,
		reputationEngine: REPUTATION_ENGINE,
		domains: DOMAINS,
		deployments,
		policy: current.policy.statement,
		policySignature: {
			payload: current.policy.payload,
			signature: current.policy.signature,
			signer: current.policy.signer,
		},
		records: current.records,
		attempts: current.attempts,
	};
};
