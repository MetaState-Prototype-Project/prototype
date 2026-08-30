/**
 * Access grants: what a platform may do with a particular kind of data.
 *
 * The certificate says which domains a platform was assessed for, and the
 * owner's policy says what they will deal with at all. Neither says anything
 * about *operations* — a platform certified for `social` is not thereby
 * entitled to write to your posts as well as read them.
 *
 * That is what a grant is for, and it is the existing `AccessGrant` ontology
 * (15d24c04-a4f3-4e45-a00e-0123926fbc87) rather than a new idea: a grantor, a
 * grantee, a resource, and a list of `resource:Action` permissions, with a
 * validity window and a revocation flag.
 *
 * Grants are deny-by-default. Passing no grant list at all means "this caller
 * is not using grants", and the layer is skipped; passing an empty list means
 * "this caller has no grants", and everything is refused. Those are different
 * statements and conflating them would silently open a vault that meant to be
 * closed.
 */

export type Operation = "read" | "write";

/** The `AccessGrant` fields that bear on a decision. */
export interface AccessGrant {
	granteeType: "ename" | "public";
	granteeEName: string | null;
	/** Domain id, or a narrower record type, in lower-kebab. */
	resourceType: string;
	/** `resource:Action` strings, e.g. `social:Read`. */
	permissions: string[];
	status: "active" | "revoked";
	validFrom?: string;
	validUntil?: string | null;
}

function action(operation: Operation): string {
	return operation === "read" ? "Read" : "Write";
}

/** The permission string a request needs, e.g. `finance:Write`. */
export function permissionFor(resource: string, operation: Operation): string {
	return `${resource}:${action(operation)}`;
}

function withinWindow(grant: AccessGrant, now: Date): boolean {
	const at = now.getTime();
	if (grant.validFrom) {
		const from = Date.parse(grant.validFrom);
		if (Number.isFinite(from) && at < from) return false;
	}
	if (grant.validUntil) {
		const until = Date.parse(grant.validUntil);
		if (Number.isFinite(until) && at > until) return false;
	}
	return true;
}

function addressesGrantee(grant: AccessGrant, grantee: string): boolean {
	if (grant.granteeType === "public") return true;
	return grant.granteeEName === grantee;
}

export interface GrantMatch {
	/** True when some grant permits the operation. */
	allowed: boolean;
	/**
	 * Why not, when refused: whether nothing addressed this grantee and
	 * resource at all, or something did but was revoked or out of date.
	 */
	reason: "granted" | "not-granted" | "revoked" | "expired";
}

/**
 * Whether any grant permits `operation` on `resource` for `grantee`.
 *
 * A revoked or expired grant that would otherwise have matched is reported
 * distinctly from no grant at all, because "your access was withdrawn" and
 * "you never had access" are different things to tell someone.
 */
export function evaluateGrants(
	grants: AccessGrant[],
	grantee: string,
	resource: string,
	operation: Operation,
	now = new Date(),
): GrantMatch {
	const wanted = permissionFor(resource, operation);
	let sawRevoked = false;
	let sawExpired = false;

	for (const grant of grants) {
		if (!addressesGrantee(grant, grantee)) continue;
		if (grant.resourceType !== resource) continue;
		if (!grant.permissions.includes(wanted)) continue;

		if (grant.status === "revoked") {
			sawRevoked = true;
			continue;
		}
		if (!withinWindow(grant, now)) {
			sawExpired = true;
			continue;
		}
		return { allowed: true, reason: "granted" };
	}

	if (sawRevoked) return { allowed: false, reason: "revoked" };
	if (sawExpired) return { allowed: false, reason: "expired" };
	return { allowed: false, reason: "not-granted" };
}
