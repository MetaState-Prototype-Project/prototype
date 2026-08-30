import { json } from "@sveltejs/kit";
import { assemble, verify } from "$lib/server/chain";
import { deployments } from "$lib/server/aaas";
import { keyFor } from "$lib/server/keys";
import type { RequestHandler } from "./$types";

/**
 * Verifies one real deployment's chain of trust, now.
 *
 * Every link is checked against evidence read from the network at request
 * time. Possession is only provable when this app has been given that
 * deployment's private key; otherwise it fails and says why, which is the
 * correct outcome rather than a gap to paper over.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { deploymentEname } = (await request.json()) as { deploymentEname?: string };
	const all = await deployments();
	const deployment = all.find((d) => d.deploymentEname === deploymentEname);
	if (!deployment) return json({ error: "Unknown deployment" }, { status: 404 });

	const assembled = await assemble(deployment);
	if (!assembled.evidence) {
		return json({ chain: null, missing: assembled.missing, possessionProven: false });
	}

	const { chain, possessionProven } = await verify(
		assembled.evidence,
		locals.user!.ename,
		keyFor(deployment.deploymentEname),
	);

	return json({ chain, missing: [], possessionProven });
};
