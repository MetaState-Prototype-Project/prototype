import { cacheService } from '$lib/services/cacheService';
import { type RegistryVault } from '$lib/services/registry';
import {
	displayNameFromUserProfile,
	fetchMetaEnvelopeById,
	isUserOntologyId,
	resolveVaultIdentity,
	type RegistryEvaultRow
} from '$lib/server/evault-graphql';
import {
	evaultPageIdForRow,
	findSenderVaultForBucket,
	isLikelyUuid,
	normalizeW3id,
	NO_SENDER_BUCKET,
	unwrapRelationIdDeep
} from '$lib/server/group-message-buckets';

const PROBE_VAULT_CONCURRENCY = 6;
const MAX_USER_VAULTS_TO_PROBE = 150;

/** Same `name` field as the dashboard table (`fetchRegistryEvaultRows`), keyed every way we might see a sender id. */
export function buildDashboardNameByKey(rows: RegistryEvaultRow[]): Map<string, string> {
	const m = new Map<string, string>();
	for (const row of rows) {
		const name = typeof row.name === 'string' ? row.name.trim() : '';
		if (!name) {
			continue;
		}
		const add = (k: string | undefined | null) => {
			if (k == null || typeof k !== 'string') {
				return;
			}
			let t = k.trim();
			if (!t) {
				return;
			}
			for (let depth = 0; depth < 6 && t; depth++) {
				m.set(t, name);
				m.set(t.toLowerCase(), name);
				const nw = normalizeW3id(t);
				if (nw) {
					m.set(nw, name);
				}
				const inner = /^(\w+)\(([^)]+)\)$/.exec(t);
				t = inner ? inner[2].trim() : '';
			}
		};
		add(row.evault);
		add(row.ename);
		add(row.id);
	}
	return m;
}

export function recordDisplayHint(
	byBucket: Map<string, Map<string, number>>,
	bucket: string,
	hint: string | null
): void {
	if (!hint?.trim()) {
		return;
	}
	const h = hint.trim();
	if (h.length < 2 || isLikelyUuid(h)) {
		return;
	}
	let counts = byBucket.get(bucket);
	if (!counts) {
		counts = new Map();
		byBucket.set(bucket, counts);
	}
	counts.set(h, (counts.get(h) ?? 0) + 1);
}

function pickBestDisplayHint(counts: Map<string, number> | undefined): string | null {
	if (!counts?.size) {
		return null;
	}
	let best: string | null = null;
	let bestN = 0;
	for (const [k, n] of counts) {
		if (n > bestN) {
			bestN = n;
			best = k;
		}
	}
	return best;
}

function collectLookupKeys(...parts: (string | null | undefined)[]): string[] {
	const keys: string[] = [];
	const seen = new Set<string>();
	const addChain = (seed: string | null | undefined) => {
		if (!seed?.trim()) {
			return;
		}
		let t = seed.trim();
		for (let depth = 0; depth < 6 && t; depth++) {
			if (!seen.has(t)) {
				seen.add(t);
				keys.push(t);
			}
			const tl = t.toLowerCase();
			if (!seen.has(tl)) {
				seen.add(tl);
				keys.push(tl);
			}
			const nw = normalizeW3id(t);
			if (nw && !seen.has(nw)) {
				seen.add(nw);
				keys.push(nw);
			}
			const inner = /^(\w+)\(([^)]+)\)$/.exec(t);
			t = inner ? inner[2].trim() : '';
		}
	};
	for (const p of parts) {
		addChain(p);
	}
	return keys;
}

export function userRegistryRowsForProbe(rows: RegistryEvaultRow[]): RegistryEvaultRow[] {
	return rows.filter(
		(r) =>
			r.type === 'user' &&
			!(typeof r.name === 'string' && /platform$/i.test(r.name.trim()))
	);
}

function registryRowToVault(row: RegistryEvaultRow): RegistryVault {
	return { ename: row.ename, uri: row.uri, evault: row.evault };
}

async function probeUserVaultsForSenderMetaEnvelopeId(
	metaEnvelopeId: string,
	userRows: RegistryEvaultRow[],
	token: string | undefined,
	probeRequestCache: Map<string, string | null>
): Promise<string | null> {
	if (!isLikelyUuid(metaEnvelopeId)) {
		return null;
	}
	const memo = probeRequestCache.get(metaEnvelopeId);
	if (memo !== undefined) {
		return memo;
	}

	const ttlHit = cacheService.getCachedSenderProfileDisplayName(metaEnvelopeId);
	if (ttlHit !== undefined) {
		probeRequestCache.set(metaEnvelopeId, ttlHit);
		return ttlHit;
	}

	const limited = userRows.slice(0, MAX_USER_VAULTS_TO_PROBE);
	if (userRows.length > MAX_USER_VAULTS_TO_PROBE) {
		console.warn(
			'[group-sender-resolve] sender profile probe capped at',
			MAX_USER_VAULTS_TO_PROBE,
			'user vaults (registry has',
			userRows.length,
			')'
		);
	}

	for (let i = 0; i < limited.length; i += PROBE_VAULT_CONCURRENCY) {
		const chunk = limited.slice(i, i + PROBE_VAULT_CONCURRENCY);
		const names = await Promise.all(
			chunk.map(async (row) => {
				const vault = registryRowToVault(row);
				const me = await fetchMetaEnvelopeById(vault, metaEnvelopeId, token);
				if (!me || !isUserOntologyId(me.ontology)) {
					return null;
				}
				return displayNameFromUserProfile(me.parsed, row.ename);
			})
		);
		for (const name of names) {
			if (name) {
				cacheService.setCachedSenderProfileDisplayName(metaEnvelopeId, name);
				probeRequestCache.set(metaEnvelopeId, name);
				return name;
			}
		}
	}

	probeRequestCache.set(metaEnvelopeId, null);
	return null;
}

async function resolveSenderDisplayName(
	bucketKey: string,
	v: RegistryVault | null,
	enameCol: string,
	token: string | undefined,
	dashboardNameByKey: Map<string, string>,
	hintByBucket: Map<string, Map<string, number>>,
	userRowsForProbe: RegistryEvaultRow[],
	probeRequestCache: Map<string, string | null>
): Promise<string> {
	for (const k of collectLookupKeys(bucketKey, enameCol)) {
		const hit = dashboardNameByKey.get(k);
		if (hit) {
			return hit;
		}
	}
	if (v) {
		const identity = await resolveVaultIdentity(v, token);
		return identity.name;
	}
	const hint = pickBestDisplayHint(hintByBucket.get(bucketKey));
	if (hint) {
		return hint;
	}
	if (enameCol && enameCol !== bucketKey && !isLikelyUuid(enameCol)) {
		return enameCol;
	}
	const trimmedBucket = bucketKey.trim();
	if (isLikelyUuid(trimmedBucket)) {
		const probed = await probeUserVaultsForSenderMetaEnvelopeId(
			trimmedBucket,
			userRowsForProbe,
			token,
			probeRequestCache
		);
		if (probed) {
			return probed;
		}
	}
	return bucketKey;
}

function firstNonEmptyStringField(
	parsed: Record<string, unknown>,
	keys: string[]
): string | null {
	for (const k of keys) {
		const v = parsed[k];
		if (typeof v === 'string' && v.trim().length > 0) {
			return v.trim();
		}
	}
	return null;
}

export function displayHintFromMessage(parsed: Record<string, unknown> | null | undefined): string | null {
	if (!parsed || typeof parsed !== 'object') {
		return null;
	}
	const top = firstNonEmptyStringField(parsed, [
		'senderName',
		'sender_display_name',
		'senderDisplayName',
		'authorName',
		'authorDisplayName',
		'fromUserName',
		'fromDisplayName'
	]);
	if (top && !isLikelyUuid(top)) {
		return top;
	}
	const sender = parsed.sender;
	if (sender && typeof sender === 'object' && !Array.isArray(sender)) {
		const s = sender as Record<string, unknown>;
		const nested = firstNonEmptyStringField(s, [
			'displayName',
			'display_name',
			'name',
			'username',
			'ename',
			'eName'
		]);
		if (nested && !isLikelyUuid(nested)) {
			return nested;
		}
	}
	return null;
}

export type ResolveSenderRowFieldsArgs = {
	bucketKey: string;
	allVaults: RegistryVault[];
	registryEnameLookup: Map<string, string>;
	token: string | undefined;
	dashboardNameByKey: Map<string, string>;
	hintByBucket: Map<string, Map<string, number>>;
	userRowsForProbe: RegistryEvaultRow[];
	probeRequestCache: Map<string, string | null>;
};

/** One sender row’s display fields (same rules as the group insights table). */
export async function resolveSenderRowFields(
	args: ResolveSenderRowFieldsArgs
): Promise<{ displayName: string; ename: string; evaultPageId: string | null }> {
	const {
		bucketKey,
		allVaults,
		registryEnameLookup,
		token,
		dashboardNameByKey,
		hintByBucket,
		userRowsForProbe,
		probeRequestCache
	} = args;

	if (bucketKey === NO_SENDER_BUCKET) {
		return {
			displayName: 'System / no sender',
			ename: '—',
			evaultPageId: null
		};
	}

	const v = findSenderVaultForBucket(bucketKey, registryEnameLookup, allVaults);
	const peeledBucket = unwrapRelationIdDeep(bucketKey.trim());
	const enameFromPeel = peeledBucket
		? registryEnameLookup.get(peeledBucket) ??
			registryEnameLookup.get(peeledBucket.toLowerCase()) ??
			registryEnameLookup.get(normalizeW3id(peeledBucket))
		: undefined;
	const enameCol =
		v?.ename?.trim() ??
		registryEnameLookup.get(bucketKey.trim()) ??
		registryEnameLookup.get(bucketKey.trim().toLowerCase()) ??
		registryEnameLookup.get(normalizeW3id(bucketKey)) ??
		enameFromPeel ??
		bucketKey;

	const displayName = await resolveSenderDisplayName(
		bucketKey,
		v,
		enameCol,
		token,
		dashboardNameByKey,
		hintByBucket,
		userRowsForProbe,
		probeRequestCache
	);

	return {
		displayName,
		ename: enameCol,
		evaultPageId: evaultPageIdForRow(v, enameCol, bucketKey)
	};
}
