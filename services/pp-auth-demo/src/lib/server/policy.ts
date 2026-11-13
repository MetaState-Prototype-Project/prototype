/**
 * The owner's terms, read from and written to their own eVault.
 *
 * The record is a signed statement, so a reader checks the signature rather
 * than trusting this app to have reported it faithfully. Records are
 * append-only; the newest valid statement for the owner is the one in force.
 */

import {
	accessPolicyPayload,
	defaultAccessPolicy,
	parseAccessPolicy,
	verifyAccessPolicy,
	type AccessPolicyStatement,
	type SignedAccessPolicy,
} from "@metastate-foundation/auth/platform";
import { verifySignature } from "signature-validator/src/index";
import { registryUrl } from "./env";
import { envelopes, store_ } from "./evault";
import { ACCESS_POLICY_ONTOLOGY } from "./ontology";

export interface LoadedPolicy {
	statement: AccessPolicyStatement;
	/** False when nothing has been signed yet and the default applies. */
	signed: boolean;
	signature: string | null;
	issuedAt: string | null;
}

async function walletVerifier(
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

/**
 * The terms in force for one owner.
 *
 * A record whose signature does not verify is ignored rather than trusted: an
 * unverifiable policy is somebody's claim about what the owner wanted, and
 * falling back to the default is the safer reading.
 */
export async function currentPolicy(ename: string): Promise<LoadedPolicy> {
	const fallback: LoadedPolicy = {
		statement: defaultAccessPolicy(ename),
		signed: false,
		signature: null,
		issuedAt: null,
	};

	let records: Array<{ id: string; parsed: Record<string, unknown> }>;
	try {
		records = await envelopes(ename, ACCESS_POLICY_ONTOLOGY, 50);
	} catch (error) {
		console.warn(`[pp-auth-demo] could not read terms for ${ename}:`, error);
		return fallback;
	}

	const candidates = records
		.map((record) => record.parsed)
		.filter((parsed) => typeof parsed.issuedAt === "string")
		.sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));

	for (const candidate of candidates) {
		const statement = parseAccessPolicy(candidate);
		if (!statement || statement.subject !== ename) continue;
		const signed: SignedAccessPolicy = {
			statement,
			payload: String(candidate.payload ?? ""),
			signature: String(candidate.signature ?? ""),
			signer: ename,
		};
		if (!(await verifyAccessPolicy(signed, walletVerifier))) continue;
		return {
			statement,
			signed: true,
			signature: signed.signature,
			issuedAt: statement.issuedAt,
		};
	}

	return fallback;
}

/** Everything the wallet needs to sign, derived from a draft. */
export function prepare(
	statement: AccessPolicyStatement,
): { statement: AccessPolicyStatement; payload: string } {
	return { statement, payload: accessPolicyPayload(statement) };
}

/**
 * Publishes signed terms into the owner's eVault, world-readable.
 *
 * The signature is verified again here before the write. A statement that
 * cannot be checked must never be stored, or a later reader will drop it and
 * the owner will believe terms are in force that are not.
 */
export async function publish(
	statement: AccessPolicyStatement,
	payload: string,
	signature: string,
): Promise<string> {
	const signed: SignedAccessPolicy = {
		statement,
		payload,
		signature,
		signer: statement.subject,
	};
	if (!(await verifyAccessPolicy(signed, walletVerifier))) {
		throw new Error("The signature over these terms did not verify");
	}
	return store_(
		statement.subject,
		ACCESS_POLICY_ONTOLOGY,
		{ ...statement, payload, signature },
		["*"],
	);
}
