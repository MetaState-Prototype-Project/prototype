import { normaliseEName, normaliseENameList } from "./ename";

/**
 * Resolving inbound chat entity references to local records.
 *
 * Every platform in this repo hand-rolled the same loop over a chat's
 * participants, and every one of them made the same two mistakes: it parsed the
 * reference with `ref.split("(")[1].split(")")[0]`, which throws on anything
 * that is not the legacy `table(uuid)` form, and it had no answer for a
 * reference that is well-formed but names nobody locally.
 *
 * Both are fixed here once, so a platform supplies only its own lookup.
 */

/** Looks up whatever local record represents the holder of an eName. */
export type ENameLookup<T> = (ename: string) => Promise<T | null>;

export interface ResolveOptions {
	/**
	 * Identifies the envelope in log lines, e.g. `chat <id> participants`. A
	 * skipped participant is only actionable if you can tell which room and
	 * which field it came from.
	 */
	context: string;
}

/**
 * Resolves a list of entity references to local records.
 *
 * References that are not usable eNames are skipped. eNames that resolve to
 * nothing locally are also skipped, and logged. Neither is fatal: a chat may
 * legitimately name members who live on a platform this instance has never
 * heard of, and losing the whole room over one of them is the bug this exists
 * to prevent.
 */
export async function resolveENameRefs<T extends object>(
	refs: unknown,
	lookup: ENameLookup<T>,
	{ context }: ResolveOptions,
): Promise<T[]> {
	const enames = normaliseENameList(refs);

	const supplied = Array.isArray(refs) ? refs.length : refs == null ? 0 : 1;
	if (supplied > enames.length) {
		console.warn(
			`[chat] ${context}: skipped ${supplied - enames.length} malformed entity reference(s)`,
		);
	}

	const resolved: T[] = [];
	for (const settled of await Promise.all(
		enames.map((ename) => resolveOne(ename, lookup, context)),
	)) {
		if (settled !== null) resolved.push(settled as T);
	}
	return resolved;
}

/**
 * Resolves a single entity reference, such as a message's sender.
 *
 * `null` covers both an unusable reference and an eName nobody local answers
 * to; the caller decides whether that is fatal for the record at hand.
 */
export async function resolveENameRef<T extends object>(
	ref: unknown,
	lookup: ENameLookup<T>,
	{ context }: ResolveOptions,
): Promise<T | null> {
	const ename = normaliseEName(ref);
	if (!ename) {
		if (ref !== null && ref !== undefined && ref !== "") {
			console.warn(`[chat] ${context}: unusable entity reference`, ref);
		}
		return null;
	}
	return resolveOne(ename, lookup, context);
}

async function resolveOne<T extends object>(
	ename: string,
	lookup: ENameLookup<T>,
	context: string,
): Promise<T | null> {
	try {
		const found = await lookup(ename);
		if (!found) {
			console.warn(`[chat] ${context}: no local record for ${ename}, skipping`);
		}
		return found;
	} catch (error) {
		// A lookup failure is per-participant, not per-room.
		console.warn(`[chat] ${context}: lookup failed for ${ename}:`, error);
		return null;
	}
}
