/**
 * The signed-in owner's own records, grouped by the domain each one falls under.
 *
 * Every schema declares its domain, so the grouping is the ontology's, not
 * ours: this is exactly the partition a certificate grants against.
 */

import { envelopes, store_ } from "./evault";
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

/**
 * A short readable line for a record.
 *
 * Most schemas carry an obvious text field. Money does not: an Account is a
 * balance and a currency, and a Ledger entry is an amount and a description, so
 * a summariser that only looks for prose renders your finances as "(no
 * readable fields)" and the demonstration shows nothing.
 */
function summarise(parsed: Record<string, unknown>): string {
	const text = [
		"text", "content", "body", "message", "title", "name",
		"displayName", "description", "summary", "label",
	];
	for (const key of text) {
		const value = parsed[key];
		if (typeof value === "string" && value.trim()) {
			return value.trim().slice(0, 160);
		}
	}

	// Numeric records: say what the number is rather than falling through.
	const amounts: string[] = [];
	if (typeof parsed.balance === "number" || typeof parsed.balance === "string") {
		amounts.push(`balance ${parsed.balance}`);
	}
	if (typeof parsed.amount === "number" || typeof parsed.amount === "string") {
		amounts.push(`amount ${parsed.amount}`);
	}
	if (typeof parsed.currencyName === "string" && parsed.currencyName) {
		amounts.push(String(parsed.currencyName));
	}
	if (typeof parsed.accountType === "string" && parsed.accountType) {
		amounts.unshift(String(parsed.accountType));
	}
	if (typeof parsed.type === "string" && parsed.type && amounts.length > 0) {
		amounts.push(String(parsed.type));
	}
	if (amounts.length > 0) return amounts.join(" · ").slice(0, 160);

	const size = typeof parsed.size === "number" ? `${parsed.size} bytes` : null;
	if (size && typeof parsed.mimeType === "string") {
		return `${parsed.mimeType} · ${size}`;
	}

	// Last resort. Identifiers and timestamps are skipped: showing
	// "updatedAt: 2026-04-07T04:49:34.455Z" tells a reader nothing about what
	// the record is, and a plain admission is more use than filler.
	const skip = /(^id$|Id$|At$|EName$|Ename$|^type$|Url$|Hash$)/;
	const first = Object.entries(parsed).find(
		([key, value]) =>
			typeof value === "string" && value.trim().length > 0 && !skip.test(key),
	);
	return first
		? `${first[0]}: ${String(first[1]).slice(0, 140)}`
		: "(a record with no readable text)";
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

/**
 * The owner's records in one domain, fetched from the eVault at call time.
 *
 * This is what a permitted read actually returns. Nothing is cached and
 * nothing is precomputed: if a request is allowed, these are the records that
 * come back, and if it is refused they are never fetched at all.
 */
export async function recordsInDomain(
	ename: string,
	domain: string,
): Promise<OwnedRecord[]> {
	const schemas = (await listSchemas()).filter((schema) => schema.domain === domain);
	const found = await Promise.all(
		schemas.map(async (schema) => {
			const records = await envelopes(ename, schema.id, 10).catch(() => []);
			return records.map((record) => ({
				id: record.id,
				kind: schema.title,
				summary: summarise(record.parsed),
			}));
		}),
	);
	return found.flat();
}

/** Where a written record goes: the first schema published for that domain. */
export async function writeTargetFor(
	domain: string,
): Promise<{ id: string; title: string } | null> {
	const schema = (await listSchemas()).find((entry) => entry.domain === domain);
	return schema ? { id: schema.id, title: schema.title } : null;
}

/**
 * Performs a permitted write.
 *
 * A write that does not write would be exactly the pretence this demonstration
 * exists to avoid, so this really does store a record in the owner's eVault —
 * with text they typed, into a schema that belongs to the domain the grant
 * covered.
 */
export async function writeRecord(
	ename: string,
	domain: string,
	text: string,
): Promise<{ id: string; kind: string } | null> {
	const target = await writeTargetFor(domain);
	if (!target) return null;
	const id = await store_(
		ename,
		target.id,
		{ text, name: text, createdAt: new Date().toISOString() },
		[ename],
	);
	return { id, kind: target.title };
}
