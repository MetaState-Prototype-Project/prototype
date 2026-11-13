/**
 * The domain vocabulary, and which domain each ontology belongs to.
 *
 * Owned by the ontology service, not by this app: every schema declares the
 * domain it belongs to, so granting a domain is what decides which record
 * types a platform may touch.
 */

import { ontologyUrl } from "./env";

export interface Domain {
	id: string;
	label: string;
	description: string;
}

export interface Schema {
	id: string;
	title: string;
	domain: string;
}

const TTL_MS = 30 * 60_000;
const STORE = Symbol.for("pp-auth-demo.ontology");
const store = globalThis as typeof globalThis & {
	[STORE]?: { at: number; domains: Domain[]; schemas: Schema[] };
};

async function load(): Promise<{ domains: Domain[]; schemas: Schema[] }> {
	const cached = store[STORE];
	if (cached && Date.now() - cached.at < TTL_MS) return cached;

	const base = ontologyUrl();
	const [domains, schemas] = await Promise.all([
		fetch(new URL("/domains", base), { signal: AbortSignal.timeout(15_000) })
			.then((r) => (r.ok ? r.json() : { domains: [] }))
			.then((b) => (b.domains ?? []) as Domain[])
			.catch(() => [] as Domain[]),
		fetch(new URL("/schemas", base), { signal: AbortSignal.timeout(15_000) })
			.then((r) => (r.ok ? r.json() : []))
			.then((b) =>
				(Array.isArray(b) ? b : [])
					.filter((s: any) => s?.id && s?.domain)
					.map((s: any) => ({ id: s.id, title: s.title ?? s.id, domain: s.domain })),
			)
			.catch(() => [] as Schema[]),
	]);

	const value = { at: Date.now(), domains, schemas };
	if (domains.length > 0) store[STORE] = value;
	return value;
}

export async function listDomains(): Promise<Domain[]> {
	return (await load()).domains;
}

export async function listSchemas(): Promise<Schema[]> {
	return (await load()).schemas;
}

/** Domain of one ontology, or null when the ontology is unknown here. */
export async function domainOf(ontologyId: string): Promise<string | null> {
	const { schemas } = await load();
	return schemas.find((schema) => schema.id === ontologyId)?.domain ?? null;
}
