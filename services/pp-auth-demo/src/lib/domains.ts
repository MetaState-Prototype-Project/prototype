/**
 * The domains this demonstration deals in.
 *
 * These four ids are taken from the published Domain vocabulary
 * (services/ontology/schemas/domain.json), which is what every schema tags
 * itself with and what a certificate grants. The full list is twenty; four is
 * enough to show separation without turning the page into a wall of buttons.
 */
export const DOMAINS = [
	{ id: "social", label: "Social" },
	{ id: "communication", label: "Communication" },
	{ id: "finance", label: "Finance" },
	{ id: "health", label: "Health" },
] as const;
