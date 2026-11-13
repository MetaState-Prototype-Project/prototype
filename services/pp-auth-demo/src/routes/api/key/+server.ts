import { json } from "@sveltejs/kit";
import { forget, remember } from "$lib/server/keys";
import type { RequestHandler } from "./$types";

/**
 * Accepts a deployment's private key so the possession link can be proved.
 *
 * Held in memory for this process only — never written to disk, never logged,
 * gone on restart. It is accepted at all because whoever is running this holds
 * these deployments, and supplying the key is how they demonstrate the one
 * link that reading public records cannot establish.
 */
export const POST: RequestHandler = async ({ request }) => {
	const { deploymentEname, privateKey } = (await request.json()) as {
		deploymentEname?: string;
		privateKey?: string;
	};
	if (!deploymentEname) return json({ error: "deploymentEname is required" }, { status: 400 });

	if (!privateKey?.trim()) {
		forget(deploymentEname);
		return json({ keyHeld: false });
	}
	remember(deploymentEname, privateKey);
	return json({ keyHeld: true });
};
