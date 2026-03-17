import { GraphQLClient, gql } from 'graphql-request';
import { PUBLIC_CONTROL_PANEL_URL, PUBLIC_REGISTRY_URL } from '$env/static/public';
import type { BindingDocument, SocialConnection } from '@metastate-foundation/types';

const BINDING_DOCUMENTS_QUERY = gql`
	query GetBindingDocuments($first: Int!, $after: String) {
		bindingDocuments(first: $first, after: $after) {
			edges {
				node {
					id
					parsed
				}
			}
			pageInfo {
				hasNextPage
				endCursor
			}
		}
	}
`;

const USER_PROFILE_QUERY = gql`
	query GetUserProfile($ontologyId: ID!, $first: Int!) {
		metaEnvelopes(filter: { ontologyId: $ontologyId }, first: $first) {
			edges {
				node {
					parsed
				}
			}
		}
	}
`;

const USER_PROFILE_ONTOLOGY = '550e8400-e29b-41d4-a716-446655440000';

interface RegistryResolveResponse {
	evaultUrl?: string;
	uri?: string;
}

interface PlatformCertificationResponse {
	token: string;
}

interface BindingDocumentsResponse {
	bindingDocuments: {
		edges: Array<{
			node: {
				id: string;
				parsed: Record<string, unknown> | null;
			};
		}>;
		pageInfo: {
			hasNextPage: boolean;
			endCursor: string | null;
		};
	};
}

class EvaultService {
	private platformToken: string | null = null;
	private profileNameCache = new Map<string, string>();

	private getRegistryUrl(): string {
		const registryUrl = PUBLIC_REGISTRY_URL || 'https://registry.w3ds.metastate.foundation';
		return registryUrl;
	}

	private getGraphqlUrl(evaultBaseUrl: string): string {
		return new URL('/graphql', evaultBaseUrl).toString();
	}

	normalizeEName(value: string): string {
		return value.startsWith('@') ? value : `@${value}`;
	}

	private async getPlatformToken(): Promise<string> {
		if (this.platformToken) return this.platformToken;
		const platform = PUBLIC_CONTROL_PANEL_URL || 'control-panel';
		const endpoint = new URL('/platforms/certification', this.getRegistryUrl()).toString();
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ platform }),
			signal: AbortSignal.timeout(10_000)
		});

		if (!response.ok) {
			throw new Error(`Failed to get platform token: HTTP ${response.status}`);
		}

		const data = (await response.json()) as PlatformCertificationResponse;
		if (!data.token) {
			throw new Error('Failed to get platform token: missing token in response');
		}

		this.platformToken = data.token;
		return this.platformToken;
	}

	async resolveEVaultUrl(eName: string): Promise<string> {
		const normalized = this.normalizeEName(eName);
		const endpoint = new URL(
			`/resolve?w3id=${encodeURIComponent(normalized)}`,
			this.getRegistryUrl()
		).toString();

		const response = await fetch(endpoint, {
			signal: AbortSignal.timeout(10_000)
		});

		if (!response.ok) {
			throw new Error(`Registry resolve failed: HTTP ${response.status}`);
		}

		const data = (await response.json()) as RegistryResolveResponse;
		const resolved = data.evaultUrl ?? data.uri;

		if (!resolved) {
			throw new Error('Registry did not return an eVault URL');
		}

		return resolved;
	}

	private async resolveDisplayNameForEName(eName: string): Promise<string> {
		const normalized = this.normalizeEName(eName);
		const cached = this.profileNameCache.get(normalized);
		if (cached) return cached;

		const [evaultBaseUrl, token] = await Promise.all([
			this.resolveEVaultUrl(normalized),
			this.getPlatformToken()
		]);

		const client = new GraphQLClient(this.getGraphqlUrl(evaultBaseUrl), {
			headers: {
				Authorization: `Bearer ${token}`,
				'X-ENAME': normalized
			}
		});

		const response = await client.request<{
			metaEnvelopes?: {
				edges?: Array<{ node?: { parsed?: Record<string, unknown> | null } }>;
			};
		}>(USER_PROFILE_QUERY, {
			ontologyId: USER_PROFILE_ONTOLOGY,
			first: 1
		});

		const profile = response.metaEnvelopes?.edges?.[0]?.node?.parsed;
		const displayName =
			(typeof profile?.displayName === 'string' && profile.displayName) ||
			(typeof profile?.name === 'string' && profile.name) ||
			normalized;

		this.profileNameCache.set(normalized, displayName);
		return displayName;
	}

	async fetchBindingDocuments(eName: string): Promise<{
		eName: string;
		documents: BindingDocument[];
		socialConnections: SocialConnection[];
	}> {
		const normalized = this.normalizeEName(eName);
		const [evaultBaseUrl, token] = await Promise.all([
			this.resolveEVaultUrl(normalized),
			this.getPlatformToken()
		]);

		const client = new GraphQLClient(this.getGraphqlUrl(evaultBaseUrl), {
			headers: {
				Authorization: `Bearer ${token}`,
				'X-ENAME': normalized
			}
		});

		const allEdges: Array<{ node: { id: string; parsed: Record<string, unknown> | null } }> = [];
		let afterCursor: string | null = null;

		do {
			const res: BindingDocumentsResponse = await client.request<BindingDocumentsResponse>(
				BINDING_DOCUMENTS_QUERY,
				{ first: 100, after: afterCursor ?? undefined }
			);
			allEdges.push(...res.bindingDocuments.edges);
			afterCursor = res.bindingDocuments.pageInfo.hasNextPage
				? res.bindingDocuments.pageInfo.endCursor
				: null;
		} while (afterCursor !== null);

		const documents: BindingDocument[] = allEdges
			.map((edge) => {
				const parsed = edge.node.parsed;
				if (!parsed || typeof parsed !== 'object') return null;
				const { subject, type, data, signatures } = parsed;
				if (
					typeof subject !== 'string' ||
					typeof type !== 'string' ||
					typeof data !== 'object' ||
					data === null ||
					!Array.isArray(signatures)
				) {
					return null;
				}
				return {
					id: edge.node.id,
					subject,
					type: type as BindingDocument['type'],
					data: data as Record<string, unknown>,
					signatures: signatures as BindingDocument['signatures']
				};
			})
			.filter((doc): doc is BindingDocument => doc !== null);

		const socialCandidates = documents.filter(
			(doc) => doc.type === 'social_connection' && doc.signatures.length === 2
		);

		const socialConnections = (
			await Promise.all(
				socialCandidates.map(async (doc) => {
					const otherPartyEName = doc.signatures.find(
						(signature) => signature.signer !== normalized
					)?.signer;

					if (!otherPartyEName) return null;

					let name: string;
					try {
						name = await this.resolveDisplayNameForEName(otherPartyEName);
					} catch {
						name = otherPartyEName;
					}

					return {
						id: doc.id,
						name,
						witnessEName: otherPartyEName,
						signatures: doc.signatures
					};
				})
			)
		).filter((entry): entry is NonNullable<typeof entry> => entry !== null);

		return { eName: normalized, documents, socialConnections };
	}
}

export const evaultService = new EvaultService();
