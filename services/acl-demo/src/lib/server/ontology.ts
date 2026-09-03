/**
 * Ontology ids, resolved from the Ontology service rather than remembered.
 *
 * A wrong schemaId fails silently — the write succeeds and every receiving
 * platform drops the packet — so the two types this demo writes are looked up
 * by title at startup and cached for the process.
 *
 * One exception, and it is not a lookup: `GROUP_ONTOLOGIES` below is the list
 * eVault's own GroupMembershipService matches on. A group record written under
 * any other ontology is not a group as far as an `_acl` decision is concerned,
 * so the constant is taken from the resolver rather than from the registry.
 */

import { ontologyUrl } from "./env";

/** Mirrors GROUP_ONTOLOGIES in evault-core/src/core/acl/group-membership.service.ts. */
export const GROUP_ONTOLOGIES = [
	"550e8400-e29b-41d4-a716-446655440003",
	"a8bfb7cf-3200-4b25-9ea9-ee41100f212e",
];

const CACHE = Symbol.for("acl-demo.ontologies");
const store = globalThis as typeof globalThis & {
	[CACHE]?: Promise<Map<string, string>>;
};

async function byTitle(): Promise<Map<string, string>> {
	store[CACHE] ??= (async () => {
		const res = await fetch(new URL("/schemas", ontologyUrl()), {
			signal: AbortSignal.timeout(15_000),
		});
		if (!res.ok) throw new Error(`ontology /schemas returned ${res.status}`);
		const schemas = (await res.json()) as Array<{ id: string; title: string }>;
		return new Map(schemas.map((schema) => [schema.title, schema.id]));
	})().catch((error) => {
		store[CACHE] = undefined;
		throw error;
	});
	return store[CACHE];
}

async function resolve(title: string): Promise<string> {
	const found = (await byTitle()).get(title);
	if (!found) throw new Error(`no ontology titled "${title}" is published`);
	return found;
}

/** The record type the demo's protected records use. */
export const postOntology = () => resolve("SocialMediaPost");

/**
 * The group type. Checked against the resolver's list, because a group written
 * under an ontology eVault does not recognise would resolve to no members and
 * quietly hand out nothing.
 */
export async function groupOntology(): Promise<string> {
	const id = await resolve("GroupManifest");
	if (!GROUP_ONTOLOGIES.includes(id)) {
		throw new Error(
			`GroupManifest resolves to ${id}, which eVault does not treat as a group`,
		);
	}
	return id;
}
