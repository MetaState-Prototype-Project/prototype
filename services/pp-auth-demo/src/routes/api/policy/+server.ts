import { json } from "@sveltejs/kit";
import {
	CERTIFICATION_LEVELS,
	defaultAccessPolicy,
	verifyAccessPolicy,
	type CertificationLevel,
} from "@metastate-foundation/auth/platform";
import { OWNER_ENAME, signPolicy, verifyOwnerSignature, world } from "$lib/server/world";
import type { RequestHandler } from "./$types";

/**
 * Records the owner's terms as a signed statement.
 *
 * The signature is made here with the owner's stand-in key; in a running
 * system this is where the eID wallet signs. It is verified immediately after
 * signing, so a statement that could not be checked never becomes the policy.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as Record<string, unknown>;
	const current = await world();

	const level = String(body.minimumLevel ?? "") as CertificationLevel;
	if (!CERTIFICATION_LEVELS.includes(level)) {
		return json({ error: "Unknown level" }, { status: 400 });
	}
	const strings = (value: unknown): string[] =>
		Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
	const minimumReputation =
		body.minimumReputation === null || body.minimumReputation === ""
			? null
			: Number(body.minimumReputation);
	if (minimumReputation !== null && !Number.isFinite(minimumReputation)) {
		return json({ error: "Reputation threshold must be a number" }, { status: 400 });
	}

	const statement = {
		...defaultAccessPolicy(OWNER_ENAME),
		minimumLevel: level,
		reputationEngine:
			typeof body.reputationEngine === "string" ? body.reputationEngine.trim() : "",
		minimumReputation,
		allowedDomains: body.allowedDomains === null ? null : strings(body.allowedDomains),
		deniedDomains: strings(body.deniedDomains),
		issuedAt: new Date().toISOString(),
		nonce: crypto.randomUUID(),
	};

	const signed = await signPolicy(statement, current.ownerKey);
	const valid = await verifyAccessPolicy(signed, (_signer, signature, payload) =>
		verifyOwnerSignature(current, signature, payload),
	);
	if (!valid) {
		return json({ error: "The signed terms did not verify" }, { status: 500 });
	}

	current.policy = signed;
	return json({ policy: signed.statement, payload: signed.payload, signature: signed.signature });
};
