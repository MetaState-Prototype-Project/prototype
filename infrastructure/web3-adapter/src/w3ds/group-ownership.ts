import { toEName } from "./ename";

/**
 * Rewrites a group's `owner` and `admins` from local user ids to eNames.
 *
 * Participants and members are TypeORM relations, so the mapping can reach
 * their `ename` directly. `owner` and `admins` are not: they are stored as bare
 * local user ids, with no relation to follow. They still name people, so they
 * are entity references and must go on the wire as eNames like every other one.
 *
 * This runs on the producer side, just before a group is handed to the mapper,
 * and is a no-op for values that are already eNames so it is safe to apply
 * more than once.
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
		const admins = await Promise.all(
			group.admins.map((admin: unknown) =>
				// An admin may already be a relation object once a platform loads
				// it as one; prefer its ename before falling back to a lookup.
				typeof admin === "object" && admin !== null
					? Promise.resolve(
							toEName((admin as { ename?: unknown }).ename ?? null),
						)
					: idToEName(admin, lookupEnameById),
			),
		);
		enriched.admins = admins.filter((a): a is string => a !== null);
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
		return toEName(await lookupEnameById(value));
	} catch (error) {
		console.warn(`[chat] could not resolve eName for user ${value}:`, error);
		return null;
	}
}
