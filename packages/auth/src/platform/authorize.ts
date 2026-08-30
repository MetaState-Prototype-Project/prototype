/**
 * What a verified platform may actually touch.
 *
 * Two independent gates, and both must open. The association's certificate
 * names the domains a release was assessed for; the owner's policy names what
 * they will permit. A social platform certified for `social` and
 * `communication` has no path to `finance` data — not because the eVault
 * recognises it as a social platform, but because `finance` is not in its
 * certificate and nothing it can present adds it.
 */

import { levelRank, type CertificationLevel, type PlatformClaim } from "./types.js";
import { type AccessPolicyStatement } from "./policy.js";

export type DenialCode =
	| "domain-not-certified"
	| "domain-refused-by-owner"
	| "domain-outside-owner-allowlist"
	| "level-below-policy"
	| "reputation-engine-not-accepted"
	| "reputation-below-policy";

export interface ReputationReading {
	/** eName or URL of the engine that produced it. */
	engine: string;
	score: number;
}

export interface AuthorizationRequest {
	claim: PlatformClaim;
	/** Domain of the record being read or written, from its ontology schema. */
	domain: string;
	reputation?: ReputationReading | null;
}

export interface AuthorizationDecision {
	allowed: boolean;
	/** Plain sentence explaining the outcome, safe to show to a person. */
	reason: string;
	code: DenialCode | "granted";
}

function deny(code: DenialCode, reason: string): AuthorizationDecision {
	return { allowed: false, reason, code };
}

export function authorize(
	policy: AccessPolicyStatement,
	request: AuthorizationRequest,
): AuthorizationDecision {
	const { claim, domain } = request;

	// The certificate first. This is the gate that stops a social platform
	// reaching finance data, and it does not depend on the owner having set
	// anything at all.
	if (!claim.domains.includes(domain)) {
		return deny(
			"domain-not-certified",
			`${claim.platformName} is not certified for ${domain} data. It may use ${claim.domains.join(", ") || "no domains"}.`,
		);
	}

	if (policy.deniedDomains.includes(domain)) {
		return deny(
			"domain-refused-by-owner",
			`You have refused all platforms access to ${domain} data.`,
		);
	}

	if (policy.allowedDomains && !policy.allowedDomains.includes(domain)) {
		return deny(
			"domain-outside-owner-allowlist",
			`You have limited platform access to ${policy.allowedDomains.join(", ")}, which does not include ${domain}.`,
		);
	}

	if (levelRank(claim.level) < levelRank(policy.minimumLevel)) {
		return deny(
			"level-below-policy",
			`${claim.platformName} is certified ${claim.level}; you asked for ${policy.minimumLevel} or better.`,
		);
	}

	if (policy.minimumReputation !== null && policy.reputationEngine) {
		const reading = request.reputation ?? null;
		if (!reading || reading.engine !== policy.reputationEngine) {
			return deny(
				"reputation-engine-not-accepted",
				`You accept reputation from ${policy.reputationEngine}, and no score from it was available.`,
			);
		}
		if (reading.score < policy.minimumReputation) {
			return deny(
				"reputation-below-policy",
				`${claim.platformName} scores ${reading.score} with ${policy.reputationEngine}; you asked for ${policy.minimumReputation} or better.`,
			);
		}
	}

	return {
		allowed: true,
		reason: `${claim.platformName} is certified ${claim.level} for ${domain} data and meets your terms.`,
		code: "granted",
	};
}

/** The domains a claim can reach under a policy, for showing an owner up front. */
export function permittedDomains(
	policy: AccessPolicyStatement,
	claim: PlatformClaim,
	reputation?: ReputationReading | null,
): string[] {
	return claim.domains.filter(
		(domain) => authorize(policy, { claim, domain, reputation }).allowed,
	);
}

export type { CertificationLevel };
