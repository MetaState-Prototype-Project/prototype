/**
 * eNames are the canonical way a chat names the people in it.
 *
 * Chat `participantIds`/`admins`/`owner` and Message `senderId` all carry an
 * entity reference. That reference used to be the id of the referent's User
 * profile MetaEnvelope, which only worked because two implementations happened
 * to agree on it. An eName is stable, self-describing, and resolvable without a
 * profile envelope, so it is what those fields carry now.
 *
 * The bootstrap case is the reason this matters rather than merely being
 * tidier: a user whose eVault holds no profile envelope yet has no envelope id
 * to emit, so a producer had to either block on provisioning one or quietly
 * emit something else. An eName exists from the moment the eVault does.
 */

/** An `@`-prefixed W3ID, e.g. `@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0`. */
export type EName = string;

/**
 * True for a non-empty `@`-prefixed string.
 *
 * Deliberately shape-only. Whether the eName resolves to anyone this platform
 * knows about is a separate question, answered by the caller, because a chat
 * may legitimately include members who live on a platform this instance has
 * never heard of.
 */
export function isEName(value: unknown): value is EName {
	return typeof value === "string" && value.startsWith("@") && value.length > 1;
}

/**
 * Coerces a bare W3ID to its `@`-prefixed form, and returns `null` for anything
 * that is not a usable reference — `null`, numbers, `""`, nested objects, and
 * the legacy `table(uuid)` form all land here.
 *
 * Returning `null` rather than throwing is the point. Inbound envelopes are
 * written by other platforms on their own release schedules, so a single
 * malformed or unrecognised entry must never take down the room it appears in.
 */
export function normaliseEName(value: unknown): EName | null {
	if (typeof value !== "string") return null;

	const trimmed = value.trim();
	if (trimmed.length === 0) return null;

	// The legacy `users(<uuid>)` / `user(<uuid>)` reference form. It is no longer
	// produced or accepted: an envelope id is not resolvable on its own, and
	// silently treating one as an eName would reintroduce the mismatch where a
	// chat replicates correctly and is then dropped on ingest with no error.
	if (trimmed.includes("(") && trimmed.includes(")")) return null;

	if (trimmed.startsWith("@")) {
		return trimmed.length > 1 ? trimmed : null;
	}

	return null;
}

/**
 * Normalises a value that may be a single reference or a list of them, dropping
 * every entry that is not a usable eName.
 *
 * A non-array, non-string input yields an empty list rather than throwing, so a
 * participant field that arrives as `null` or an object degrades to "no
 * participants named here" instead of failing the whole ingest.
 */
export function normaliseENameList(value: unknown): EName[] {
	const entries = Array.isArray(value) ? value : [value];

	const seen = new Set<EName>();
	for (const entry of entries) {
		const ename = normaliseEName(entry);
		if (ename) seen.add(ename);
	}
	return [...seen];
}

/**
 * Renders a value as an eName for an outbound envelope.
 *
 * Producers hold a local user record whose `ename` column may or may not carry
 * the `@`. Both are accepted here and the `@`-prefixed form is what goes on the
 * wire, so consumers only ever have to recognise one shape.
 */
export function toEName(value: unknown): EName | null {
	if (typeof value !== "string") return null;

	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	if (trimmed.includes("(") && trimmed.includes(")")) return null;

	return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}
