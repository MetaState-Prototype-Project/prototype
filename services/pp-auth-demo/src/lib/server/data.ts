/**
 * The signed-in owner's own records, grouped by the domain each one falls under.
 *
 * Every schema declares its domain, so the grouping is the ontology's, not
 * ours: this is exactly the partition a certificate grants against.
 */

import { envelopes } from "./evault";
import { listDomains, listSchemas } from "./domains";

export interface OwnedRecord {
	id: string;
	/** The schema's human title, e.g. "Social Media Post". */
	kind: string;
	summary: string;
}

export interface DomainGroup {
	id: string;
	label: string;
	description: string;
	records: OwnedRecord[];
}

/** A short readable line for a record, without guessing at its shape. */
function summarise(parsed: Record<string, unknown>): string {
	const preferred = [
		"text", "content", "body", "message", "title", "name",
		"displayName", "description", "summary", "label",
	];
	for (const key of preferred) {
		const value = parsed[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim().slice(0, 160);
		}
	}
	const first = Object.entries(parsed).find(
		([, value]) => typeof value === "string" && value.trim().length > 0,
	);
	return first ? `${first[0]}: ${String(first[1]).slice(0, 140)}` : "(no readable fields)";
}

/**
 * Everything the owner holds, by domain.
 *
 * Each schema is queried separately because that is the only way an eVault can
 * be asked for records; they run together so the page does not wait on them in
 * series. A schema the vault holds nothing of simply contributes nothing.
 */
export async function ownedByDomain(ename: string): Promise<DomainGroup[]> {
	const [schemas, domains] = await Promise.all([listSchemas(), listDomains()]);
	if (schemas.length === 0) return [];

	const byDomain = new Map<string, OwnedRecord[]>();

	const results = await Promise.all(
		schemas.map(async (schema) => {
			const found = await envelopes(ename, schema.id, 10).catch(() => []);
			return { schema, found };
		}),
	);

	for (const { schema, found } of results) {
		if (found.length === 0) continue;
		const list = byDomain.get(schema.domain) ?? [];
		for (const record of found) {
			list.push({
				id: record.id,
				kind: schema.title,
				summary: summarise(record.parsed),
			});
		}
		byDomain.set(schema.domain, list);
	}

	return [...byDomain.entries()]
		.map(([id, records]) => {
			const domain = domains.find((d) => d.id === id);
			return {
				id,
				label: domain?.label ?? id,
				description: domain?.description ?? "",
				records: records.slice(0, 12),
			};
		})
		.sort((a, b) => b.records.length - a.records.length);
}
