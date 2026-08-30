import { json } from "@sveltejs/kit";
import {
	answerChallenge,
	verifyHandshake,
} from "@metastate-foundation/auth/platform";
import { OWNER_ENAME, world } from "$lib/server/world";
import type { RequestHandler } from "./$types";

/** Runs the handshake alone, so the chain can be inspected without touching data. */
export const POST: RequestHandler = async ({ request }) => {
	const { deploymentId } = (await request.json()) as { deploymentId?: string };
	const current = await world();
	const deployment = current.deployments.get(String(deploymentId));
	if (!deployment) return json({ error: "Unknown deployment" }, { status: 404 });

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

	return json({ chain, challenge });
};
