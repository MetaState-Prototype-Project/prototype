/**
 * Access grants, kept in the owner's own eVault as `AccessGrant` records.
 *
 * Records are append-only, which is what the ontology's `revision` field is
 * for: changing what a platform may do writes a new record rather than editing
 * the old one, so the history of who was given what, and when it was taken
 * away, survives. The newest revision for a (grantee, resource) pair is the one
 * in force.
 */

import type { AccessGrant, Operation } from "@metastate-foundation/auth/platform";
import { permissionFor } from "@metastate-foundation/auth/platform";
import { randomUUID } from "node:crypto";
import { envelopes, store_ } from "./evault";
import { ACCESS_GRANT_ONTOLOGY } from "./ontology";

export interface StoredGrant extends AccessGrant {
	grantId: string;
	grantorEName: string;
	revision: number;
	createdAt: string;
	updatedAt: string;
	revokedAt: string | null;
}

function key(granteeEName: string | null, resourceType: string): string {
	return `${granteeEName ?? "*"}::${resourceType}`;
}

/**
 * The grants in force for one owner: newest revision per grantee and resource.
 *
 * Revoked records are kept rather than filtered out, so `evaluateGrants` can
 * tell "withdrawn" apart from "never held" — which are different things to
 * show someone.
 */
export async function currentGrants(ename: string): Promise<StoredGrant[]> {
	let records: Array<{ id: string; parsed: Record<string, unknown> }>;
	try {
		records = await envelopes(ename, ACCESS_GRANT_ONTOLOGY, 200);
	} catch (error) {
		console.warn(`[pp-auth-demo] could not read grants for ${ename}:`, error);
		return [];
	}

	const newest = new Map<string, StoredGrant>();
	for (const record of records) {
		const raw = record.parsed;
		if (raw.isReference === true) continue;
		if (raw.grantorEName !== ename) continue;
		const resourceType = typeof raw.resourceType === "string" ? raw.resourceType : "";
		const granteeEName =
			typeof raw.granteeEName === "string" ? raw.granteeEName : null;
		if (!resourceType) continue;

		const grant: StoredGrant = {
			grantId: String(raw.grantId ?? ""),
			grantorEName: ename,
			granteeType: raw.granteeType === "public" ? "public" : "ename",
			granteeEName,
			resourceType,
			permissions: Array.isArray(raw.permissions)
				? raw.permissions.filter((p): p is string => typeof p === "string")
				: [],
			status: raw.status === "revoked" ? "revoked" : "active",
			validFrom: typeof raw.validFrom === "string" ? raw.validFrom : undefined,
			validUntil: typeof raw.validUntil === "string" ? raw.validUntil : null,
			revision: Number(raw.revision) || 1,
			createdAt: String(raw.createdAt ?? ""),
			updatedAt: String(raw.updatedAt ?? raw.createdAt ?? ""),
			revokedAt: typeof raw.revokedAt === "string" ? raw.revokedAt : null,
		};

		const existing = newest.get(key(granteeEName, resourceType));
		if (!existing || grant.revision > existing.revision) {
			newest.set(key(granteeEName, resourceType), grant);
		}
	}

	return [...newest.values()];
}

/**
 * Records what one platform may do with one kind of data.
 *
 * An empty operation list revokes rather than deleting: the record stays and is
 * marked withdrawn, so a later reader can see that access was taken away rather
 * than finding a silent absence.
 */
export async function setGrant(
	ename: string,
	granteeEName: string,
	resourceType: string,
	operations: Operation[],
	existing: StoredGrant[],
): Promise<void> {
	const previous = existing.find(
		(grant) =>
			grant.granteeEName === granteeEName && grant.resourceType === resourceType,
	);
	const now = new Date().toISOString();
	const revoking = operations.length === 0;

	const payload = {
		isReference: false,
		grantId: previous?.grantId || randomUUID(),
		grantorEName: ename,
		granteeType: "ename" as const,
		granteeEName,
		resourceType,
		// A revoked grant keeps the permissions it used to carry, so the record
		// says what was withdrawn rather than merely that something was.
		permissions: revoking
			? previous?.permissions?.length
				? previous.permissions
				: [permissionFor(resourceType, "read")]
			: operations.map((operation) => permissionFor(resourceType, operation)),
		status: revoking ? ("revoked" as const) : ("active" as const),
		validFrom: previous?.validFrom ?? now,
		validUntil: null,
		createdAt: previous?.createdAt || now,
		updatedAt: now,
		revision: (previous?.revision ?? 0) + 1,
		revokedAt: revoking ? now : null,
		delegationAllowed: false,
	};

	await store_(ename, ACCESS_GRANT_ONTOLOGY, payload, [ename, granteeEName]);
}
