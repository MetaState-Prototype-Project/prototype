import { json } from "@sveltejs/kit";
import {
	CERTIFICATION_LEVELS,
	defaultAccessPolicy,
	type CertificationLevel,
} from "@metastate-foundation/auth/platform";
import { randomUUID } from "node:crypto";
import { prepare } from "$lib/server/policy";
import { createSigningOffer } from "$lib/server/session";
import type { RequestHandler } from "./$types";

/**
 * Turns a draft into a statement and asks the wallet to sign it.
 *
 * The signing session id is the canonical payload itself, so what the wallet
 * signs is exactly the digest of these terms — the resulting signature stands
 * on its own, without anyone having to trust this app's session store.
 */
export const POST: RequestHandler = async ({ request, locals, url }) => {
	const body = (await request.json()) as Record<string, unknown>;
	const ename = locals.user!.ename;

	const level = String(body.minimumLevel ?? "") as CertificationLevel;
	if (!CERTIFICATION_LEVELS.includes(level)) {
		return json({ error: "Pick a level" }, { status: 400 });
	}
	const strings = (value: unknown): string[] =>
		Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
	const minimumReputation =
		body.minimumReputation === null || body.minimumReputation === ""
			? null
			: Number(body.minimumReputation);
	if (minimumReputation !== null && !Number.isFinite(minimumReputation)) {
		return json({ error: "The score must be a number" }, { status: 400 });
	}

	const statement = {
		...defaultAccessPolicy(ename),
		minimumLevel: level,
		reputationEngine:
			typeof body.reputationEngine === "string" ? body.reputationEngine.trim() : "",
		minimumReputation,
		allowedDomains: null,
		deniedDomains: strings(body.deniedDomains),
		issuedAt: new Date().toISOString(),
		nonce: randomUUID(),
	};

	const prepared = prepare(statement);
	const offer = createSigningOffer(
		prepared.payload,
		{
			message: "Set the terms platforms must meet to reach your data",
			minimumLevel: statement.minimumLevel,
			reputationEngine: statement.reputationEngine || "not used",
			minimumReputation: statement.minimumReputation ?? "no threshold",
			refused: statement.deniedDomains.length ? statement.deniedDomains : "nothing",
		},
		url.origin,
	);

	return json({ statement, payload: prepared.payload, uri: offer.uri });
};
