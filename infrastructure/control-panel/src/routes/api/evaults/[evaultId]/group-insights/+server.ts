import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_CONTROL_PANEL_URL } from '$env/static/public';
import { cacheService } from '$lib/services/cacheService';
import { registryService, type RegistryVault } from '$lib/services/registry';
import {
	displayNameFromUserProfile,
	evaultGraphqlPost,
	fetchGroupManifestOrFallbackParsed,
	fetchMetaEnvelopeById,
	fetchRegistryEvaultRows,
	isUserOntologyId,
	MESSAGE_ONTOLOGY_ID,
	requestPlatformToken,
	resolveVaultIdentity,
	type RegistryEvaultRow
} from '$lib/server/evault-graphql';

/**
 * Strategy A: resolve message `senderId` (User MetaEnvelope global id) by probing registry user vaults with
 * `metaEnvelope(id)` + X-ENAME. Strategy C (long-term): denormalize senderEname/display on write in
 * web3-adapter / Blabsy message mapping — avoids O(senders × vaults) GraphQL.
 */
const PROBE_VAULT_CONCURRENCY = 6;
const MAX_USER_VAULTS_TO_PROBE = 150;

const MESSAGES_PAGE_QUERY = `
	query GroupMessages($filter: MetaEnvelopeFilterInput, $first: Int, $after: String) {
		metaEnvelopes(filter: $filter, first: $first, after: $after) {
			totalCount
			pageInfo {
				hasNextPage
				endCursor
			}
			edges {
				node {
					parsed
				}
			}
		}
	}
`;

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

type MessageConnection = {
	totalCount?: number;
	pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
	edges?: Array<{ node?: { parsed?: Record<string, unknown> } }>;
};

function readMessageConnection(payload: Record<string, unknown> | null): MessageConnection | null {
	if (!payload) {
		return null;
	}
	const data = payload.data as Record<string, unknown> | undefined;
	const conn = data?.metaEnvelopes as MessageConnection | undefined;
	return conn ?? null;
}

/** Match dashboard / monitoring: ignore leading @ and case when comparing W3IDs. */
function normalizeW3id(s: string): string {
	return s.trim().replace(/^@+/u, '').toLowerCase();
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isLikelyUuid(s: string): boolean {
	return UUID_RE.test(s.trim());
}

/**
 * Web3-adapter stores relations as `user(firebaseOrGlobalId)` in some paths; registry keys are often the inner id.
 * Peel wrappers so sender buckets line up with registry `evault` / mapping global ids.
 */
function unwrapRelationIdDeep(raw: string | null | undefined): string | null {
	if (raw == null || typeof raw !== 'string') {
		return null;
	}
	let t = raw.trim();
	if (!t) {
		return null;
	}
	for (let i = 0; i < 4; i++) {
		const m = /^(\w+)\(([^)]+)\)$/.exec(t);
		if (!m) {
			break;
		}
		const inner = m[2].trim();
		if (!inner || inner === t) {
			break;
		}
		t = inner;
	}
	return t || null;
}

/** Same `name` field as the dashboard table (`fetchRegistryEvaultRows`), keyed every way we might see a sender id. */
function buildDashboardNameByKey(rows: RegistryEvaultRow[]): Map<string, string> {
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

function recordDisplayHint(
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

function userRegistryRowsForProbe(rows: RegistryEvaultRow[]): RegistryEvaultRow[] {
	return rows.filter(
		(r) =>
			r.type === 'user' &&
			!(typeof r.name === 'string' && /platform$/i.test(r.name.trim()))
	);
}

function registryRowToVault(row: RegistryEvaultRow): RegistryVault {
	return { ename: row.ename, uri: row.uri, evault: row.evault };
}

/**
 * `metaEnvelopeId` is the web3-adapter global id stored on messages (User profile row id in that user's vault).
 * Values are `string` when resolved, `null` when this request already probed all vaults without a hit.
 */
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
			'[group-insights] sender profile probe capped at',
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

/** Build evault id / raw ename → canonical registry `ename` for resolving message senders. */
function buildRegistryEnameLookup(vaults: RegistryVault[]): Map<string, string> {
	const map = new Map<string, string>();
	for (const v of vaults) {
		const en = typeof v.ename === 'string' && v.ename.trim() ? v.ename.trim() : '';
		if (!en) {
			continue;
		}
		map.set(en, en);
		map.set(en.toLowerCase(), en);
		const nw = normalizeW3id(en);
		if (nw) {
			map.set(nw, en);
		}
		if (v.evault) {
			map.set(v.evault, en);
			map.set(v.evault.toLowerCase(), en);
		}
	}
	return map;
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

/** Raw sender id from payload (UUID / legacy), not used as the aggregation key when registry resolves. */
function rawMessageSenderId(parsed: Record<string, unknown> | null | undefined): string | null {
	if (!parsed || typeof parsed !== 'object') {
		return null;
	}
	for (const v of [parsed.senderId, parsed.sender_id, parsed.userId]) {
		if (typeof v === 'string' && v.trim().length > 0) {
			return unwrapRelationIdDeep(v.trim());
		}
		if (typeof v === 'number' && Number.isFinite(v)) {
			return String(v);
		}
	}
	return null;
}

function displayHintFromMessage(parsed: Record<string, unknown> | null | undefined): string | null {
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

/**
 * Bucket key for counts: W3ID eName when possible (manifest + UI use @…).
 * 1) eName fields on the message payload
 * 2) registry lookup: senderId / userId as evault id
 */
function resolveMessageSenderEname(
	parsed: Record<string, unknown> | null | undefined,
	registryLookup: Map<string, string>
): string | null {
	if (!parsed || typeof parsed !== 'object') {
		return null;
	}
	const fromPayload = firstNonEmptyStringField(parsed, [
		'senderEname',
		'sender_ename',
		'senderEName',
		'eName',
		'ename',
		'senderW3id',
		'w3id'
	]);
	if (fromPayload) {
		return (
			registryLookup.get(fromPayload) ??
			registryLookup.get(fromPayload.toLowerCase()) ??
			registryLookup.get(normalizeW3id(fromPayload)) ??
			fromPayload
		);
	}
	const rawId = rawMessageSenderId(parsed);
	if (!rawId) {
		return null;
	}
	return (
		registryLookup.get(rawId) ??
		registryLookup.get(rawId.toLowerCase()) ??
		registryLookup.get(normalizeW3id(rawId)) ??
		null
	);
}

const NO_SENDER_BUCKET = '__no_sender__';

/** Stable aggregation key: canonical ename when resolvable, else raw sender id, else system bucket. */
function senderBucketKey(
	parsed: Record<string, unknown> | null | undefined,
	registryLookup: Map<string, string>
): string {
	const ename = resolveMessageSenderEname(parsed, registryLookup);
	if (ename) {
		return ename;
	}
	const raw = rawMessageSenderId(parsed);
	if (raw) {
		return raw;
	}
	return NO_SENDER_BUCKET;
}

function findSenderVaultForBucket(
	bucketKey: string,
	lookup: Map<string, string>,
	vaults: RegistryVault[]
): RegistryVault | null {
	const trimmed = bucketKey.trim();
	const peeled = unwrapRelationIdDeep(trimmed);
	if (peeled && peeled !== trimmed) {
		const nested = findSenderVaultForBucket(peeled, lookup, vaults);
		if (nested) {
			return nested;
		}
	}
	const lower = trimmed.toLowerCase();

	const byEvault = vaults.find((v) => v.evault === trimmed);
	if (byEvault) {
		return byEvault;
	}
	const byEvaultCi = vaults.find((v) => (v.evault ?? '').toLowerCase() === lower);
	if (byEvaultCi) {
		return byEvaultCi;
	}

	const canonFromLookup =
		lookup.get(trimmed) ?? lookup.get(lower) ?? lookup.get(normalizeW3id(trimmed));
	if (canonFromLookup) {
		const v = vaults.find(
			(x) =>
				x.ename === canonFromLookup ||
				normalizeW3id(x.ename) === normalizeW3id(canonFromLookup)
		);
		if (v) {
			return v;
		}
	}

	const bucketNorm = normalizeW3id(trimmed);
	if (bucketNorm) {
		const byNorm = vaults.find((x) => normalizeW3id(x.ename) === bucketNorm);
		if (byNorm) {
			return byNorm;
		}
	}

	return (
		vaults.find(
			(x) => x.ename === trimmed || x.ename.toLowerCase() === lower
		) ?? null
	);
}

type SenderRow = { displayName: string; ename: string; messageCount: number };

async function mapInChunks<T, R>(items: T[], chunkSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = [];
	for (let i = 0; i < items.length; i += chunkSize) {
		const chunk = items.slice(i, i + chunkSize);
		out.push(...(await Promise.all(chunk.map(fn))));
	}
	return out;
}

async function buildSenderRows(
	byBucket: Record<string, number>,
	registryEnameLookup: Map<string, string>,
	allVaults: RegistryVault[],
	token: string | undefined,
	dashboardNameByKey: Map<string, string>,
	hintByBucket: Map<string, Map<string, number>>,
	userRowsForProbe: RegistryEvaultRow[],
	probeRequestCache: Map<string, string | null>
): Promise<SenderRow[]> {
	const entries = Object.entries(byBucket).filter(([k]) => k !== NO_SENDER_BUCKET);
	const rows = await mapInChunks(entries, 8, async ([bucketKey, messageCount]) => {
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

		return { displayName, ename: enameCol, messageCount };
	});

	rows.sort((a, b) => b.messageCount - a.messageCount);

	const noSenderCount = byBucket[NO_SENDER_BUCKET] ?? 0;
	if (noSenderCount > 0) {
		rows.push({
			displayName: 'System / no sender',
			ename: '—',
			messageCount: noSenderCount
		});
	}

	return rows;
}

function previewMessageBody(parsed: Record<string, unknown> | undefined): string | undefined {
	if (!parsed) {
		return undefined;
	}
	for (const key of ['text', 'content', 'body'] as const) {
		const v = parsed[key];
		if (typeof v === 'string' && v.length > 0) {
			const oneLine = v.replace(/\s+/g, ' ').trim();
			return oneLine.length > 160 ? `${oneLine.slice(0, 160)}…` : oneLine;
		}
	}
	return undefined;
}

/** Log one JSON line per scanned message. Set `CONTROL_PANEL_LOG_GROUP_MESSAGES=0` to disable. */
const LOG_EACH_MESSAGE = process.env.CONTROL_PANEL_LOG_GROUP_MESSAGES !== '0';

export const GET: RequestHandler = async ({ params, url }) => {
	const evaultId = params.evaultId;

	try {
		const allVaults = await registryService.getEVaults();
		const registryEnameLookup = buildRegistryEnameLookup(allVaults);

		const vault = allVaults.find((v) => v.evault === evaultId || v.ename === evaultId);

		if (!vault) {
			return json({ error: `eVault '${evaultId}' not found in registry.` }, { status: 404 });
		}

		const platform = PUBLIC_CONTROL_PANEL_URL || url.origin;
		let token: string | undefined;
		try {
			token = await requestPlatformToken(platform);
		} catch (tokenError) {
			console.warn('Group insights: no platform token:', tokenError);
		}

		let registryRows: RegistryEvaultRow[] = [];
		try {
			registryRows = await fetchRegistryEvaultRows(token);
		} catch (rowsErr) {
			console.warn('Group insights: fetchRegistryEvaultRows failed:', rowsErr);
		}
		const dashboardNameByKey = buildDashboardNameByKey(registryRows);
		const hintByBucket = new Map<string, Map<string, number>>();

		const manifest = await fetchGroupManifestOrFallbackParsed(vault, token);
		if (!manifest) {
			return json(
				{
					error:
						'Could not load group manifest from this vault (not a group eVault, unreachable, or auth failed).'
				},
				{ status: 400 }
			);
		}

		const byBucket: Record<string, number> = {};
		let messagesScanned = 0;
		let totalCount = 0;
		let after: string | undefined;
		let capped = false;

		for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
			const variables: Record<string, unknown> = {
				filter: { ontologyId: MESSAGE_ONTOLOGY_ID },
				first: PAGE_SIZE
			};
			if (after) {
				variables.after = after;
			}

			const payload = await evaultGraphqlPost({
				uri: vault.uri,
				ename: vault.ename,
				query: MESSAGES_PAGE_QUERY,
				variables,
				token,
				timeoutMs: 15000
			});

			const conn = readMessageConnection(payload);
			if (!conn) {
				break;
			}

			if (pageIndex === 0 && typeof conn.totalCount === 'number') {
				totalCount = conn.totalCount;
			}

			const edges = conn.edges ?? [];
			for (const edge of edges) {
				const parsed = edge.node?.parsed as Record<string, unknown> | undefined;
				const senderEname = resolveMessageSenderEname(parsed, registryEnameLookup);
				const rawSenderId = rawMessageSenderId(parsed);
				const bucket = senderBucketKey(parsed, registryEnameLookup);
				byBucket[bucket] = (byBucket[bucket] ?? 0) + 1;
				messagesScanned += 1;
				recordDisplayHint(hintByBucket, bucket, displayHintFromMessage(parsed));

				if (LOG_EACH_MESSAGE) {
					console.log(
						'[group-insights:message]',
						JSON.stringify({
							evaultId,
							vaultEname: vault.ename,
							index: messagesScanned,
							senderBucket: bucket,
							senderEname: senderEname ?? null,
							senderId: rawSenderId ?? null,
							id: parsed?.id ?? null,
							chatId: parsed?.chatId ?? null,
							isSystemMessage: parsed?.isSystemMessage ?? null,
							preview: previewMessageBody(parsed),
							parsedKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed).sort() : []
						})
					);
				}
			}

			const hasNext = conn.pageInfo?.hasNextPage === true;
			const endCursor = conn.pageInfo?.endCursor;
			if (!hasNext || edges.length === 0) {
				break;
			}
			if (pageIndex === MAX_PAGES - 1) {
				capped = true;
				break;
			}
			after = endCursor ?? undefined;
		}

		const messagesWithoutSender = byBucket[NO_SENDER_BUCKET] ?? 0;
		const messagesWithSenderBucket = Math.max(0, messagesScanned - messagesWithoutSender);
		const userRowsForProbe = userRegistryRowsForProbe(registryRows);
		const probeRequestCache = new Map<string, string | null>();
		const senderRows = await buildSenderRows(
			byBucket,
			registryEnameLookup,
			allVaults,
			token,
			dashboardNameByKey,
			hintByBucket,
			userRowsForProbe,
			probeRequestCache
		);

		console.log('[group-insights:summary]', {
			evaultId,
			vaultEname: vault.ename,
			totalCount,
			messagesScanned,
			messagesWithSenderBucket,
			messagesWithoutSender,
			senderRowCount: senderRows.length,
			capped,
			byBucket,
			perMessageLinesLogged: LOG_EACH_MESSAGE
		});

		return json({
			evault: {
				ename: vault.ename,
				uri: vault.uri,
				evault: vault.evault
			},
			manifest,
			messageStats: {
				totalCount,
				messagesScanned,
				messagesWithSenderBucket,
				messagesWithoutSender,
				capped,
				senderRows
			}
		});
	} catch (error) {
		console.error('Error fetching group insights:', error);
		return json({ error: 'Failed to fetch group insights' }, { status: 500 });
	}
};
