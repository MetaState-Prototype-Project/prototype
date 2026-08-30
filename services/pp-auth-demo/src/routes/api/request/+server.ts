import { json } from "@sveltejs/kit";
import { authorize, type Operation, type PlatformClaim } from "@metastate-foundation/auth/platform";
import { deployments, platformProfile } from "$lib/server/aaas";
import { assemble, verify } from "$lib/server/chain";
import { recordsInDomain, writeRecord } from "$lib/server/data";
import { currentGrants } from "$lib/server/grants";
import { keyFor } from "$lib/server/keys";
import { currentPolicy } from "$lib/server/policy";
import type { RequestHandler } from "./$types";

/**
 * One request, all the way through.
 *
 * A deployment proves what it is, and then the three gates decide what it may
 * do: the association's certificate, the owner's terms, and the grants. The
 * response reports each stage separately so it is clear which one refused.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const body = (await request.json()) as {
		deploymentEname?: string;
		domain?: string;
		operation?: string;
		text?: string;
	};
	const operation: Operation = body.operation === "write" ? "write" : "read";
	const domain = String(body.domain ?? "");
	const ename = locals.user!.ename;

	const all = await deployments();
	const deployment = all.find((d) => d.deploymentEname === body.deploymentEname);
	if (!deployment || !domain) {
		return json({ error: "Unknown deployment or domain" }, { status: 404 });
	}

	const assembled = await assemble(deployment);
	if (!assembled.evidence) {
		return json({
			stage: "evidence",
			missing: assembled.missing,
			chain: null,
			decision: null,
		});
	}

	const { chain } = await verify(
		assembled.evidence,
		ename,
		keyFor(deployment.deploymentEname),
	);

	// Without a proven identity there is nothing to authorise. Refusing here is
	// the whole point: an unproven caller does not get to reach anything,
	// however generous the grants behind it are.
	if (!chain.ok || !chain.claim) {
		return json({ stage: "handshake", chain, decision: null, missing: [] });
	}

	const [policy, grants, profile] = await Promise.all([
		currentPolicy(ename),
		currentGrants(ename),
		platformProfile(deployment.platformEname),
	]);

	const claim: PlatformClaim = {
		...chain.claim,
		platformName: profile?.displayName || chain.claim.platformName,
	};

	const decision = authorize(policy.statement, {
		claim,
		domain,
		operation,
		grants,
	});

	if (!decision.allowed) {
		// Nothing is fetched. A refusal that still read the data and then
		// declined to show it would not be a refusal at all.
		return json({ stage: "authorised", chain, decision, records: null, wrote: null });
	}

	if (operation === "write") {
		const text = String(body.text ?? "").trim();
		if (!text) {
			return json({
				stage: "authorised",
				chain,
				decision,
				records: null,
				wrote: null,
				note: "Permitted, but nothing was written — no text was given.",
			});
		}
		const wrote = await writeRecord(ename, domain, text);
		return json({
			stage: "authorised",
			chain,
			decision,
			records: await recordsInDomain(ename, domain),
			wrote,
		});
	}

	// The point of the whole exercise: a permitted read really does go to the
	// eVault and come back with the records.
	return json({
		stage: "authorised",
		chain,
		decision,
		records: await recordsInDomain(ename, domain),
		wrote: null,
	});
};

export const GET: RequestHandler = async () =>
	json({ error: "POST a deployment, domain and operation" }, { status: 405 });
