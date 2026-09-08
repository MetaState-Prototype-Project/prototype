import { toEName } from "./ename";

/**
 * Rewrites a group's `owner`, and its `admins` when they are bare ids, to
 * eNames.
 *
 * Participants and members are TypeORM relations, so the mapping can reach
 * their `ename` directly. `owner` is never a relation: it is stored as a bare
 * local user id with nothing to follow. `admins` is one or the other depending
 * on the platform — a `User[]` relation on most, a `string[]` of local ids on
 * cerberus and group-charter-manager.
 *
 * Either way they name people, so they are entity references and must go on the
 * wire as eNames. A relation is left untouched, because the mapping for those
 * platforms reads `admins[].ename` and flattening it to strings would leave it
 * asking for `.ename` on a string and emitting an empty list.
 *
 * Runs on the producer side just before a group reaches the mapper, and is a
 * no-op for values that are already eNames, so it is safe to apply twice.
 */
export async function enrichGroupOwnership(
	// biome-ignore lint/suspicious/noExplicitAny: TypeORM entity snapshot
	group: any,
	lookupEnameById: (id: string) => Promise<string | null>,
	// biome-ignore lint/suspicious/noExplicitAny: TypeORM entity snapshot
): Promise<any> {
	if (!group || typeof group !== "object") return group;

	const enriched = { ...group };

	if (group.owner !== undefined) {
		enriched.owner = await idToEName(group.owner, lookupEnameById);
	}

	if (Array.isArray(group.admins)) {
		// A relation already carries `ename`, and the mapping reaches it
		// directly. Only a list of bare ids needs rewriting.
		const isRelation = group.admins.some(
			(admin: unknown) => typeof admin === "object" && admin !== null,
		);

		if (!isRelation) {
			const admins = await Promise.all(
				group.admins.map((admin: unknown) => idToEName(admin, lookupEnameById)),
			);
			enriched.admins = admins.filter((a): a is string => a !== null);
		}
	}

	return enriched;
}

async function idToEName(
	value: unknown,
	lookupEnameById: (id: string) => Promise<string | null>,
): Promise<string | null> {
	if (typeof value !== "string" || value.length === 0) return null;

	// Already an eName: nothing to look up.
	const asEName = value.startsWith("@") ? toEName(value) : null;
	if (asEName) return asEName;

	try {
		const ename = await lookupEnameById(value);
		// Only a real lookup result becomes an eName. Falling back to the input
		// would turn an unresolved local id into `@<uuid>` — syntactically a
		// valid eName, semantically nobody — which is precisely the kind of
		// silently-wrong reference this whole change exists to remove. An
		// unresolved owner is better left null and skipped by the consumer.
		if (!ename) {
			console.warn(`[chat] no eName for user ${value}, dropping reference`);
			return null;
		}
		return toEName(ename);
	} catch (error) {
		console.warn(`[chat] could not resolve eName for user ${value}:`, error);
		return null;
	}
}
