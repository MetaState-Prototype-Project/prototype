import { PUBLIC_REGISTRY_URL } from '$env/static/public';
import { registryService, type RegistryVault } from '$lib/services/registry';

export const USER_ONTOLOGY_ID = '550e8400-e29b-41d4-a716-446655440000';
/** Ontology id used when storing group manifests (web3-adapter, Blabsy/Pictique/charter group.mapping.json, MessageNotificationService). */
export const GROUP_ONTOLOGY_ID = '550e8400-e29b-41d4-a716-446655440003';
/** Alternate id from services/ontology/schemas/groupManifest.json — try if primary misses. */
export const GROUP_ONTOLOGY_ID_LEGACY = 'a8bfb7cf-3200-4b25-9ea9-ee41100f212e';
export const MESSAGE_ONTOLOGY_ID = '550e8400-e29b-41d4-a716-446655440004';

const META_ENVELOPES_PARSED_QUERY = `
	query MetaEnvelopes($filter: MetaEnvelopeFilterInput, $first: Int) {
		metaEnvelopes(filter: $filter, first: $first) {
			edges {
				node {
					parsed
				}
			}
		}
	}
`;

const META_ENVELOPE_BY_ID_QUERY = `
	query MetaEnvelopeById($id: ID!) {
		metaEnvelope(id: $id) {
			id
			ontology
			parsed
		}
	}
`;

const LEGACY_GET_META_ENVELOPE_BY_ID_QUERY = `
	query LegacyGetMetaEnvelopeById($id: String!) {
		getMetaEnvelopeById(id: $id) {
			id
			ontology
			parsed
		}
	}
`;

/** Chat and GroupManifest share ontology 550e8400-...003; scan enough rows to find the manifest. */
const GROUP_MANIFEST_SCAN_FIRST = 80;

function parsedListFromMetaEnvelopesPayload(
	payload: Record<string, unknown> | null
): Record<string, unknown>[] {
	if (!payload) {
		return [];
	}
	const data = payload.data as Record<string, unknown> | undefined;
	const metaEnvelopes = data?.metaEnvelopes as Record<string, unknown> | undefined;
	const edges = metaEnvelopes?.edges as Array<{ node?: { parsed?: unknown } }> | undefined;
	if (!edges?.length) {
		return [];
	}
	const out: Record<string, unknown>[] = [];
	for (const edge of edges) {
		const parsed = edge.node?.parsed;
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			out.push(parsed as Record<string, unknown>);
		}
	}
	return out;
}

export async function fetchParsedListByOntology(
	vault: RegistryVault,
	ontologyId: string,
	token: string | undefined,
	first: number
): Promise<Record<string, unknown>[]> {
	const payload = await evaultGraphqlPost({
		uri: vault.uri,
		ename: vault.ename,
		query: META_ENVELOPES_PARSED_QUERY,
		variables: {
			filter: { ontologyId },
			first
		},
		token,
		timeoutMs: 12000
	});
	return parsedListFromMetaEnvelopesPayload(payload);
}

/** True when `parsed` looks like GroupManifest (not Chat: those use participantIds, not members). */
export function isGroupManifestParsed(parsed: unknown): parsed is Record<string, unknown> {
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return false;
	}
	const o = parsed as Record<string, unknown>;
	return Array.isArray(o.members) && typeof o.owner === 'string';
}

export type VaultIdentity = { name: string; type: 'user' | 'group' | 'unknown' };

export async function requestPlatformToken(platform: string): Promise<string> {
	const registryUrl = PUBLIC_REGISTRY_URL || 'https://registry.staging.metastate.foundation';
	const response = await fetch(new URL('/platforms/certification', registryUrl).toString(), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ platform }),
		signal: AbortSignal.timeout(2500)
	});

	if (!response.ok) {
		throw new Error(`Failed to get platform token: HTTP ${response.status}`);
	}

	const data = (await response.json()) as { token?: string };
	if (!data.token) {
		throw new Error('Failed to get platform token: missing token in response');
	}

	return data.token;
}

export type EvaultGraphqlPostOptions = {
	uri: string;
	ename: string;
	query: string;
	variables?: Record<string, unknown>;
	token?: string;
	timeoutMs?: number;
};

/**
 * POST GraphQL to a vault. Tries Bearer token first when provided, then X-ENAME-only.
 * Returns parsed JSON body or null on failure.
 */
export async function evaultGraphqlPost(
	options: EvaultGraphqlPostOptions
): Promise<Record<string, unknown> | null> {
	const timeoutMs = options.timeoutMs ?? 2500;
	const tryRequest = async (withAuth: boolean): Promise<Record<string, unknown> | null> => {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-ENAME': options.ename
		};
		if (withAuth && options.token) {
			headers.Authorization = `Bearer ${options.token}`;
		}

		const response = await fetch(`${options.uri}/graphql`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				query: options.query,
				variables: options.variables ?? {}
			}),
			signal: AbortSignal.timeout(timeoutMs)
		});

		if (!response.ok) {
			return null;
		}

		const payload = (await response.json()) as Record<string, unknown>;
		if (Array.isArray(payload?.errors) && (payload.errors as unknown[]).length > 0) {
			return null;
		}
		return payload;
	};

	try {
		const withAuth = await tryRequest(Boolean(options.token));
		if (withAuth) {
			return withAuth;
		}
		if (options.token) {
			return await tryRequest(false);
		}
		return null;
	} catch {
		return null;
	}
}

function firstNonEmptyString(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === 'string' && value.trim().length > 0) {
			return value.trim();
		}
	}
	return null;
}

/** Dashboard-style label: user profile displayName/username, else fallbacks (e.g. ename, evault id). */
export function displayNameFromUserProfile(
	profile: Record<string, unknown> | null | undefined,
	...fallbacks: unknown[]
): string {
	const fromProfile = firstNonEmptyString(profile?.displayName, profile?.name, profile?.username);
	if (fromProfile) {
		return fromProfile;
	}
	return firstNonEmptyString(...fallbacks) ?? 'Unknown';
}

export async function fetchFirstParsedByOntology(
	vault: RegistryVault,
	ontologyId: string,
	token?: string
): Promise<Record<string, unknown> | null> {
	const payload = await evaultGraphqlPost({
		uri: vault.uri,
		ename: vault.ename,
		query: META_ENVELOPES_PARSED_QUERY,
		variables: {
			filter: { ontologyId },
			first: 1
		},
		token
	});

	if (!payload) {
		return null;
	}
	const data = payload.data as Record<string, unknown> | undefined;
	const metaEnvelopes = data?.metaEnvelopes as Record<string, unknown> | undefined;
	const edges = metaEnvelopes?.edges as Array<{ node?: { parsed?: unknown } }> | undefined;
	const parsed = edges?.[0]?.node?.parsed;

	if (!parsed || typeof parsed !== 'object') {
		return null;
	}

	return parsed as Record<string, unknown>;
}

function readMetaEnvelopeNode(
	payload: Record<string, unknown> | null
): { ontology: string; parsed: Record<string, unknown> } | null {
	if (!payload) {
		return null;
	}
	const data = payload.data as Record<string, unknown> | undefined;
	const node =
		(data?.metaEnvelope as Record<string, unknown> | undefined | null) ??
		(data?.getMetaEnvelopeById as Record<string, unknown> | undefined | null);
	if (!node || typeof node !== 'object') {
		return null;
	}
	const ontology = typeof node.ontology === 'string' ? node.ontology : '';
	const parsed = node.parsed;
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		return null;
	}
	return { ontology, parsed: parsed as Record<string, unknown> };
}

/**
 * Load a single MetaEnvelope by id in the given vault context (X-ENAME + optional Bearer).
 * Tries idiomatic `metaEnvelope(id)` then legacy `getMetaEnvelopeById`.
 */
export async function fetchMetaEnvelopeById(
	vault: RegistryVault,
	metaEnvelopeId: string,
	token?: string
): Promise<{ ontology: string; parsed: Record<string, unknown> } | null> {
	const tryIdiomatic = await evaultGraphqlPost({
		uri: vault.uri,
		ename: vault.ename,
		query: META_ENVELOPE_BY_ID_QUERY,
		variables: { id: metaEnvelopeId },
		token,
		timeoutMs: 8000
	});
	const fromIdiomatic = readMetaEnvelopeNode(tryIdiomatic);
	if (fromIdiomatic) {
		return fromIdiomatic;
	}

	const tryLegacy = await evaultGraphqlPost({
		uri: vault.uri,
		ename: vault.ename,
		query: LEGACY_GET_META_ENVELOPE_BY_ID_QUERY,
		variables: { id: metaEnvelopeId },
		token,
		timeoutMs: 8000
	});
	return readMetaEnvelopeNode(tryLegacy);
}

export function isUserOntologyId(ontologyField: string): boolean {
	return ontologyField.trim().toLowerCase() === USER_ONTOLOGY_ID.toLowerCase();
}

/**
 * Prefer a full GroupManifest among meta-envelopes with ontology 003 (Chat uses the same id).
 * Otherwise return the first matching row (e.g. chat) for name/display fallbacks.
 */
export async function fetchGroupManifestOrFallbackParsed(
	vault: RegistryVault,
	token?: string
): Promise<Record<string, unknown> | null> {
	const primaryList = await fetchParsedListByOntology(
		vault,
		GROUP_ONTOLOGY_ID,
		token,
		GROUP_MANIFEST_SCAN_FIRST
	);
	const manifestHit = primaryList.find((p) => isGroupManifestParsed(p));
	if (manifestHit) {
		return manifestHit;
	}
	if (primaryList.length > 0) {
		return primaryList[0];
	}

	const legacyList = await fetchParsedListByOntology(
		vault,
		GROUP_ONTOLOGY_ID_LEGACY,
		token,
		GROUP_MANIFEST_SCAN_FIRST
	);
	const legacyManifest = legacyList.find((p) => isGroupManifestParsed(p));
	if (legacyManifest) {
		return legacyManifest;
	}
	return legacyList[0] ?? null;
}

export async function resolveVaultIdentity(
	vault: RegistryVault,
	token?: string
): Promise<VaultIdentity> {
	const defaultName = firstNonEmptyString(vault.ename, vault.evault, 'Unknown') || 'Unknown';

	const userProfile = await fetchFirstParsedByOntology(vault, USER_ONTOLOGY_ID, token);
	if (userProfile) {
		return {
			type: 'user',
			name:
				firstNonEmptyString(
					userProfile.displayName,
					userProfile.name,
					userProfile.username,
					vault.ename,
					vault.evault
				) || defaultName
		};
	}

	const groupManifest = await fetchGroupManifestOrFallbackParsed(vault, token);
	if (groupManifest) {
		return {
			type: 'group',
			name:
				firstNonEmptyString(
					groupManifest.name,
					groupManifest.displayName,
					groupManifest.title,
					groupManifest.eName,
					groupManifest.ename,
					vault.ename,
					vault.evault
				) || defaultName
		};
	}

	return {
		type: 'unknown',
		name: defaultName
	};
}

/** One row in the control-panel eVault list (registry + resolved identity). */
export interface RegistryEvaultRow {
	id: string;
	name: string;
	type: 'user' | 'group' | 'unknown';
	ename: string;
	uri: string;
	evault: string;
	status: string;
	serviceUrl?: string;
}

export async function fetchRegistryEvaultRows(token?: string): Promise<RegistryEvaultRow[]> {
	const registryVaults = await registryService.getEVaults();
	return Promise.all(
		registryVaults.map(async (vault) => {
			const evaultId = vault.evault || vault.ename;
			const identity = await resolveVaultIdentity(vault, token);
			return {
				id: evaultId,
				name: identity.name,
				type: identity.type,
				ename: vault.ename,
				uri: vault.uri,
				evault: vault.evault,
				status: 'Unknown',
				serviceUrl: vault.uri
			};
		})
	);
}
