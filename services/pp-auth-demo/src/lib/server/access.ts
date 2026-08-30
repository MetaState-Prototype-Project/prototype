/**
 * One request through the whole mechanism: handshake, then the two gates.
 *
 * Every attempt runs the full handshake rather than caching a session. That is
 * slower than a real deployment would be, and deliberate — the point of the
 * demonstrator is that you can see the chain re-checked on each attempt and
 * watch it fail the moment a link is broken.
 */

import {
	answerChallenge,
	authorize,
	verifyHandshake,
	type AuthorizationDecision,
	type ChainResult,
} from "@metastate-foundation/auth/platform";
import { randomUUID } from "node:crypto";
import { OWNER_ENAME, REPUTATION_ENGINE, type World } from "./world";

export interface AccessOutcome {
	chain: ChainResult;
	decision: AuthorizationDecision | null;
	records: World["records"];
}

export async function attemptAccess(
	current: World,
	deploymentId: string,
	domain: string,
	write?: { kind: string; body: string },
): Promise<AccessOutcome> {
	const deployment = current.deployments.get(deploymentId);
	if (!deployment) throw new Error(`unknown deployment ${deploymentId}`);

	const challenge = current.challenges.issue(OWNER_ENAME);
	const response = await answerChallenge(deployment.identity, challenge);
	const chain = await verifyHandshake(response, {
		audience: OWNER_ENAME,
		registryBaseUrl: "demo://registry",
		registryJwksUri: "demo://registry/.well-known/jwks.json",
		verifyWalletSignature: current.roots.verifyWalletSignature,
		resolveJwks: current.resolveJwks,
		store: current.challenges,
	});

	if (!chain.ok || !chain.claim) {
		record(current, deployment.id, deployment.identity.evidence.deploymentName, domain, {
			allowed: false,
			code: "handshake-failed",
			reason: `Could not establish who this is: ${chain.links.find((link) => !link.ok)?.detail ?? "the chain of trust did not hold"}`,
		});
		return { chain, decision: null, records: [] };
	}

	const score = current.reputation.get(chain.claim.platformEname);
	const decision = authorize(current.policy.statement, {
		claim: chain.claim,
		domain,
		reputation:
			score === undefined ? null : { engine: REPUTATION_ENGINE, score },
	});
	record(
		current,
		deployment.id,
		chain.claim.platformName,
		domain,
		decision,
	);

	if (!decision.allowed) return { chain, decision, records: [] };

	if (write) {
		current.records.unshift({
			id: randomUUID(),
			domain,
			kind: write.kind,
			body: write.body,
			writtenBy: chain.claim.platformName,
			at: new Date().toISOString(),
		});
	}

	return {
		chain,
		decision,
		records: current.records.filter((entry) => entry.domain === domain),
	};
}

function record(
	current: World,
	deploymentId: string,
	deploymentName: string,
	domain: string,
	decision: { allowed: boolean; reason: string; code: string },
): void {
	current.attempts.unshift({
		id: randomUUID(),
		at: new Date().toISOString(),
		deploymentId,
		deploymentName,
		domain,
		allowed: decision.allowed,
		reason: decision.reason,
		code: decision.code,
	});
	current.attempts.splice(50);
}
