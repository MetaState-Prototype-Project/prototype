/**
 * Deployment side of the handshake.
 *
 * The deployment presents evidence rather than being looked up, so a verifier
 * needs only public endpoints to check it — no read access to the platform's
 * eVault, which is the access it is trying to obtain in the first place.
 */

import { challengePayload } from "./chain.js";
import { signP256 } from "./p256.js";
import type {
	DeploymentEvidence,
	HandshakeChallenge,
	HandshakeResponse,
} from "./types.js";

export interface DeploymentIdentity {
	evidence: DeploymentEvidence;
	/** PKCS#8 base64. The only secret in the whole exchange. */
	privateKey: string;
}

export async function answerChallenge(
	identity: DeploymentIdentity,
	challenge: HandshakeChallenge,
): Promise<HandshakeResponse> {
	const signature = await signP256(
		identity.privateKey,
		challengePayload(challenge, identity.evidence.deploymentEname),
	);
	return { challenge, evidence: identity.evidence, signature };
}

/** Fetches a challenge, answers it, and returns whatever the verifier decided. */
export async function authenticate(
	identity: DeploymentIdentity,
	verifierBaseUrl: string,
	fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
	const challengeResponse = await fetchImpl(
		new URL("/pp-auth/challenge", verifierBaseUrl).toString(),
		{ method: "POST" },
	);
	if (!challengeResponse.ok) {
		throw new Error(`challenge request failed: ${challengeResponse.status}`);
	}
	const challenge = (await challengeResponse.json()) as HandshakeChallenge;
	const answer = await answerChallenge(identity, challenge);
	const verified = await fetchImpl(
		new URL("/pp-auth/verify", verifierBaseUrl).toString(),
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(answer),
		},
	);
	return verified.json();
}
