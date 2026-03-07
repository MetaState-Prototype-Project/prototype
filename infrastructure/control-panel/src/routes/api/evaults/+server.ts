import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';
import { registryService, type RegistryVault } from '$lib/services/registry';

const USER_ONTOLOGY_ID = '550e8400-e29b-41d4-a716-446655440000';
const GROUP_ONTOLOGY_ID = 'a8bfb7cf-3200-4b25-9ea9-ee41100f212e';

const META_ENVELOPES_QUERY = `
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

export interface EVault {
	id: string; // evault identifier (evault field from registry)
	name: string; // display name (ename or evault)
	type: 'user' | 'group'; // derived from ontology lookup
	ename: string; // w3id identifier
	uri: string; // resolved service URI
	evault: string; // evault identifier
	status: string; // derived from health check
	serviceUrl?: string; // same as uri for display
}

function firstNonEmptyString(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === 'string' && value.trim().length > 0) {
			return value.trim();
		}
	}
	return null;
}

async function fetchFirstParsedByOntology(
	vault: RegistryVault,
	ontologyId: string,
	token?: string
): Promise<Record<string, unknown> | null> {
	const tryRequest = async (withAuth: boolean): Promise<Record<string, unknown> | null> => {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-ENAME': vault.ename
		};
		if (withAuth && token) {
			headers.Authorization = `Bearer ${token}`;
		}

		const response = await fetch(`${vault.uri}/graphql`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				query: META_ENVELOPES_QUERY,
				variables: {
					filter: { ontologyId },
					first: 1
				}
			}),
			signal: AbortSignal.timeout(2500)
		});

		if (!response.ok) {
			return null;
		}

		const payload = await response.json();
		if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
			return null;
		}
		const parsed = payload?.data?.metaEnvelopes?.edges?.[0]?.node?.parsed;

		if (!parsed || typeof parsed !== 'object') {
			return null;
		}

		return parsed as Record<string, unknown>;
	};

	try {
		// Try with token first (preferred), then fallback to X-ENAME-only.
		const withAuth = await tryRequest(Boolean(token));
		if (withAuth) {
			return withAuth;
		}

		if (token) {
			return await tryRequest(false);
		}

		return null;
	} catch {
		return null;
	}
}

async function resolveVaultIdentity(
	vault: RegistryVault,
	token?: string
): Promise<{ name: string; type: 'user' | 'group' }> {
	const defaultName = firstNonEmptyString(vault.ename, vault.evault, 'Unknown') || 'Unknown';

	const userProfile = await fetchFirstParsedByOntology(vault, USER_ONTOLOGY_ID, token);
	if (userProfile) {
		return {
			type: 'user',
			name:
				firstNonEmptyString(userProfile.displayName, userProfile.username, vault.ename, vault.evault) ||
				defaultName
		};
	}

	const groupManifest = await fetchFirstParsedByOntology(vault, GROUP_ONTOLOGY_ID, token);
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
				) ||
				defaultName
		};
	}

	return {
		type: 'group',
		name: defaultName
	};
}

async function requestPlatformToken(platform: string): Promise<string> {
	const registryUrl = env.PUBLIC_REGISTRY_URL || 'https://registry.staging.metastate.foundation';
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

export const GET: RequestHandler = async ({ url }) => {
	try {
		const platform = env.PUBLIC_CONTROL_PANEL_URL || url.origin;
		let token: string | undefined;
		try {
			token = await requestPlatformToken(platform);
		} catch (tokenError) {
			console.warn('Falling back to X-ENAME-only eVault queries:', tokenError);
		}

		// Fetch all evaults from registry
		const registryVaults = await registryService.getEVaults();

		// Transform registry vaults to EVault format
		const evaults: EVault[] = await Promise.all(
			registryVaults.map(async (vault) => {
				// Use evault identifier as the primary ID, fallback to ename
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

		// Filter out platform-owned user profiles (e.g. "File Manager Platform").
		const filteredEVaults = evaults.filter(
			(vault) => !(vault.type === 'user' && /platform$/i.test(vault.name.trim()))
		);

		console.log(`Total eVaults found: ${filteredEVaults.length}`);
		return json({ evaults: filteredEVaults });
	} catch (error) {
		console.error('Error fetching eVaults:', error);
		return json({ error: 'Failed to fetch eVaults', evaults: [] }, { status: 500 });
	}
};
