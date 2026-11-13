/**
 * The terms an eVault owner sets for platforms that want to reach their data.
 *
 * Certification is a trust statement, not a permission: the association says
 * what a release was found to be, and the owner decides what that is worth to
 * them. This is where the owner's half is written down — the level they insist
 * on, whose reputation scores they will accept, and any domain they refuse
 * outright no matter what the certificate says.
 *
 * It is a signed statement rather than a setting so it travels with the owner
 * and can be checked by anyone: an eVault, a platform deciding whether to
 * bother asking, or the owner themselves auditing what they agreed to.
 */

import { sha256Base64Url, stableStringify } from "./bytes.js";
import { CERTIFICATION_LEVELS, type CertificationLevel } from "./types.js";

const POLICY_PREFIX = "w3ds:access-policy:v1:";
export const POLICY_TYPE = "w3ds.evault.access-policy";

export interface AccessPolicyStatement {
	type: typeof POLICY_TYPE;
	schemaVersion: 1;
	/** eName of the vault owner these terms belong to. */
	subject: string;
	/** The weakest certification the owner will deal with. */
	minimumLevel: CertificationLevel;
	/**
	 * eName or URL of the reputation service whose scores the owner accepts.
	 * Empty means the owner does not weigh reputation at all.
	 */
	reputationEngine: string;
	/** Score that engine must report, on its own scale. Null when unused. */
	minimumReputation: number | null;
	/**
	 * Domains the owner permits. Null means "whatever the certificate grants",
	 * which is the ordinary case; a list narrows that further.
	 */
	allowedDomains: string[] | null;
	/** Domains refused outright, overriding both of the above. */
	deniedDomains: string[];
	issuedAt: string;
	nonce: string;
}

export interface SignedAccessPolicy {
	statement: AccessPolicyStatement;
	/** What was signed: the prefix plus a digest of the canonical statement. */
	payload: string;
	signature: string;
	signer: string;
}

export function accessPolicyPayload(statement: AccessPolicyStatement): string {
	return POLICY_PREFIX + sha256Base64Url(stableStringify(statement));
}

/** The terms that apply when an owner has never set any. */
export function defaultAccessPolicy(subject: string): AccessPolicyStatement {
	return {
		type: POLICY_TYPE,
		schemaVersion: 1,
		subject,
		// L2 is the lowest level the framework issues to a release whose
		// responsible actors are identified at all, so it is the natural floor
		// for a vault that has expressed no preference.
		minimumLevel: "L2",
		reputationEngine: "",
		minimumReputation: null,
		allowedDomains: null,
		deniedDomains: [],
		issuedAt: new Date(0).toISOString(),
		nonce: "default",
	};
}

export function parseAccessPolicy(value: unknown): AccessPolicyStatement | null {
	if (!value || typeof value !== "object") return null;
	const raw = value as Record<string, unknown>;
	const level = String(raw.minimumLevel ?? "") as CertificationLevel;
	if (
		raw.type !== POLICY_TYPE ||
		raw.schemaVersion !== 1 ||
		typeof raw.subject !== "string" ||
		!raw.subject.startsWith("@") ||
		!CERTIFICATION_LEVELS.includes(level)
	) {
		return null;
	}
	const strings = (input: unknown): string[] =>
		Array.isArray(input)
			? input.filter((item): item is string => typeof item === "string")
			: [];
	return {
		type: POLICY_TYPE,
		schemaVersion: 1,
		subject: raw.subject,
		minimumLevel: level,
		reputationEngine:
			typeof raw.reputationEngine === "string" ? raw.reputationEngine : "",
		minimumReputation:
			typeof raw.minimumReputation === "number" ? raw.minimumReputation : null,
		allowedDomains:
			raw.allowedDomains === null || raw.allowedDomains === undefined
				? null
				: strings(raw.allowedDomains),
		deniedDomains: strings(raw.deniedDomains),
		issuedAt: typeof raw.issuedAt === "string" ? raw.issuedAt : "",
		nonce: typeof raw.nonce === "string" ? raw.nonce : "",
	};
}

/**
 * Checks that the policy was signed by the owner it claims to bind. The signer
 * must be the subject: a policy signed by anyone else is somebody setting terms
 * on a vault that is not theirs.
 */
export async function verifyAccessPolicy(
	signed: SignedAccessPolicy,
	verifyWalletSignature: (
		signer: string,
		signature: string,
		payload: string,
	) => Promise<boolean>,
): Promise<boolean> {
	const statement = parseAccessPolicy(signed.statement);
	if (!statement) return false;
	if (signed.signer !== statement.subject) return false;
	if (signed.payload !== accessPolicyPayload(statement)) return false;
	return verifyWalletSignature(signed.signer, signed.signature, signed.payload);
}
