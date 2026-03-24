import type { RegistryVault } from '$lib/services/registry';

/** Literal bucket key for messages with no sender id (must match group-insights aggregation). */
export const NO_SENDER_BUCKET = '__no_sender__';

/** Match dashboard / monitoring: ignore leading @ and case when comparing W3IDs. */
export function normalizeW3id(s: string): string {
	return s.trim().replace(/^@+/u, '').toLowerCase();
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLikelyUuid(s: string): boolean {
	return UUID_RE.test(s.trim());
}

/**
 * Web3-adapter stores relations as `user(firebaseOrGlobalId)` in some paths; registry keys are often the inner id.
 * Peel wrappers so sender buckets line up with registry `evault` / mapping global ids.
 */
export function unwrapRelationIdDeep(raw: string | null | undefined): string | null {
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

/** Build evault id / raw ename → canonical registry `ename` for resolving message senders. */
export function buildRegistryEnameLookup(vaults: RegistryVault[]): Map<string, string> {
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
export function rawMessageSenderId(parsed: Record<string, unknown> | null | undefined): string | null {
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

/**
 * Bucket key for counts: W3ID eName when possible (manifest + UI use @…).
 * 1) eName fields on the message payload
 * 2) registry lookup: senderId / userId as evault id
 */
export function resolveMessageSenderEname(
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

/** Stable aggregation key: canonical ename when resolvable, else raw sender id, else system bucket. */
export function senderBucketKey(
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

export function previewMessageBody(parsed: Record<string, unknown> | undefined): string | undefined {
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

export function findSenderVaultForBucket(
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
		vaults.find((x) => x.ename === trimmed || x.ename.toLowerCase() === lower) ?? null
	);
}

/** Segment for `/evaults/[id]` — matches client list `id === evault || ename`. */
export function evaultPageIdForRow(
	v: RegistryVault | null,
	enameCol: string,
	bucketKey: string
): string | null {
	if (v) {
		const link = (v.evault?.trim() || v.ename?.trim()) ?? '';
		if (link) {
			return link;
		}
	}
	const en = enameCol.trim();
	if (en && en !== '—' && !isLikelyUuid(en)) {
		return en;
	}
	const bk = bucketKey.trim();
	if (bk && bk !== NO_SENDER_BUCKET && !isLikelyUuid(bk)) {
		return bk;
	}
	return null;
}
