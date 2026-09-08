import { normaliseEName, normaliseENameList } from "web3-adapter";
import type { User } from "../database/entities/User";
import type { UserService } from "../services/UserService";

/**
 * Resolves the entity references in an inbound chat envelope to local users.
 *
 * Chat participants, admins, and a message's sender are named by eName. This
 * turns those names into the local `User` rows that represent them, and is the
 * only place that decides what happens when one of them cannot be resolved.
 *
 * Two rules, both of which used to be violated in ways that lost whole rooms:
 *
 *  - A reference that is not a usable eName is skipped, not fatal. The old
 *    `ref.split("(")[1].split(")")[0]` threw a TypeError on any bare eName,
 *    which took down ingest for the entire envelope.
 *  - A well-formed eName that names nobody locally is also skipped, and logged.
 *    Members may legitimately live on a platform this instance knows nothing
 *    about, and one such member must not cost the room its other members.
 */
export async function resolveParticipants(
	refs: unknown,
	userService: UserService,
	context: string,
): Promise<User[]> {
	const enames = normaliseENameList(refs);

	const skipped = countSkipped(refs, enames.length);
	if (skipped > 0) {
		console.warn(
			`[chat] ${context}: skipped ${skipped} malformed entity reference(s)`,
		);
	}

	const resolved = await Promise.all(
		enames.map(async (ename) => {
			const user = await userService.findByEname(ename).catch((error) => {
				console.warn(`[chat] ${context}: lookup failed for ${ename}:`, error);
				return null;
			});
			if (!user) {
				console.warn(
					`[chat] ${context}: no local user for ${ename}, skipping participant`,
				);
			}
			return user;
		}),
	);

	return resolved.filter((user): user is User => user !== null);
}

/**
 * Resolves a single entity reference, such as a message's sender.
 *
 * Returns `null` both for an unusable reference and for an eName nobody local
 * answers to; the caller decides whether that is fatal for the record at hand.
 */
export async function resolveEntityRef(
	ref: unknown,
	userService: UserService,
	context: string,
): Promise<User | null> {
	const ename = normaliseEName(ref);
	if (!ename) {
		if (ref !== null && ref !== undefined) {
			console.warn(`[chat] ${context}: unusable entity reference`, ref);
		}
		return null;
	}

	const user = await userService.findByEname(ename).catch((error) => {
		console.warn(`[chat] ${context}: lookup failed for ${ename}:`, error);
		return null;
	});
	if (!user) {
		console.warn(`[chat] ${context}: no local user for ${ename}`);
	}
	return user;
}

function countSkipped(refs: unknown, kept: number): number {
	const total = Array.isArray(refs) ? refs.length : refs == null ? 0 : 1;
	return Math.max(0, total - kept);
}
