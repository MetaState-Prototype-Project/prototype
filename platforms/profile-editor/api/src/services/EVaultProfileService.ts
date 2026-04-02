import { GraphQLClient } from "graphql-request";
import { RegistryService } from "./RegistryService";
import type {
	ProfessionalProfile,
	FullProfile,
	UserOntologyData,
} from "../types/profile";

const PROFESSIONAL_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440009";
const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

function normalizeEName(eName: string): string {
	return eName.startsWith("@") ? eName : `@${eName}`;
}

const META_ENVELOPES_QUERY = `
  query MetaEnvelopes($filter: MetaEnvelopeFilterInput, $first: Int, $after: String) {
    metaEnvelopes(filter: $filter, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          ontology
          parsed
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

const META_ENVELOPE_QUERY = `
  query MetaEnvelope($id: ID!) {
    metaEnvelope(id: $id) {
      id
      ontology
      parsed
    }
  }
`;

const CREATE_MUTATION = `
  mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
    createMetaEnvelope(input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
      errors { field message code }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateMetaEnvelope($id: ID!, $input: MetaEnvelopeInput!) {
    updateMetaEnvelope(id: $id, input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
      errors { message code }
    }
  }
`;

type MetaEnvelopeNode = {
	id: string;
	ontology: string;
	parsed: Record<string, unknown>;
};

type MetaEnvelopesResult = {
	metaEnvelopes: {
		edges: Array<{ cursor: string; node: MetaEnvelopeNode }>;
		pageInfo: { hasNextPage: boolean; endCursor: string };
		totalCount: number;
	};
};

type MetaEnvelopeResult = {
	metaEnvelope: MetaEnvelopeNode | null;
};

type CreateResult = {
	createMetaEnvelope: {
		metaEnvelope: MetaEnvelopeNode | null;
		errors: Array<{ field?: string; message: string; code?: string }>;
	};
};

type UpdateResult = {
	updateMetaEnvelope: {
		metaEnvelope: MetaEnvelopeNode | null;
		errors: Array<{ message: string; code?: string }>;
	};
};

export interface PreparedWrite {
	profile: FullProfile;
	persisted: Promise<void>;
}

/**
 * Strip empty arrays from eVault payload — serializeValue([]) is broken
 * in the eVault (doesn't JSON-stringify), so we omit them and let the
 * eVault delete those Envelope nodes. Reads default to [].
 */
function buildPayload(merged: ProfessionalProfile): Record<string, unknown> {
	const payload: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(merged)) {
		if (value === null || value === undefined) continue;
		if (Array.isArray(value) && value.length === 0) continue;
		payload[key] = value;
	}
	return payload;
}

function buildFullProfile(
	eName: string,
	merged: ProfessionalProfile,
	userData: UserOntologyData,
): FullProfile {
	const name = merged.displayName ?? userData.displayName ?? eName;
	return {
		ename: eName,
		name,
		handle: userData.username,
		isVerified: userData.isVerified,
		professional: {
			displayName: merged.displayName,
			headline: merged.headline,
			bio: merged.bio,
			avatarFileId: merged.avatarFileId,
			bannerFileId: merged.bannerFileId,
			cvFileId: merged.cvFileId,
			videoIntroFileId: merged.videoIntroFileId,
			email: merged.email,
			phone: merged.phone,
			website: merged.website,
			location: merged.location,
			isPublic: merged.isPublic === true,
			workExperience: merged.workExperience ?? [],
			education: merged.education ?? [],
			skills: merged.skills ?? [],
			socialLinks: merged.socialLinks ?? [],
		},
	};
}

interface CacheEntry {
	profile: FullProfile;
	expiresAt: number;
}

export class EVaultProfileService {
	private registryService: RegistryService;
	/**
	 * Short-lived profile cache. Prevents repeated eVault round-trips for
	 * the same user within a short window (e.g. page load fetches profile
	 * data + avatar + banner = 3 calls). Invalidated immediately on writes.
	 */
	private cache = new Map<string, CacheEntry>();
	private static CACHE_TTL = 30 * 1000; // 30 seconds

	constructor(registryService: RegistryService) {
		this.registryService = registryService;
	}

	private async getClient(eName: string): Promise<GraphQLClient> {
		const endpoint = await this.registryService.getEvaultGraphqlUrl(eName);
		const token = await this.registryService.ensurePlatformToken();
		return new GraphQLClient(endpoint, {
			headers: {
				Authorization: `Bearer ${token}`,
				"X-ENAME": normalizeEName(eName),
			},
		});
	}

	private async findMetaEnvelopeByOntology(
		client: GraphQLClient,
		ontologyId: string,
	): Promise<MetaEnvelopeNode | null> {
		const result = await client.request<MetaEnvelopesResult>(
			META_ENVELOPES_QUERY,
			{
				filter: { ontologyId },
				first: 10,
			},
		);
		if (result.metaEnvelopes.totalCount > 1) {
			console.warn(
				`[eVault] DUPLICATE ENVELOPES: ${result.metaEnvelopes.totalCount} for ontology ${ontologyId}`,
			);
		}
		const edge = result.metaEnvelopes.edges[0];
		return edge?.node ?? null;
	}

	/** Fetch profile from eVault (bypasses cache). */
	private async fetchFromEvault(eName: string): Promise<FullProfile> {
		const client = await this.getClient(eName);

		const [professionalNode, userNode] = await Promise.all([
			this.findMetaEnvelopeByOntology(client, PROFESSIONAL_PROFILE_ONTOLOGY),
			this.findMetaEnvelopeByOntology(client, USER_ONTOLOGY),
		]);

		const userData = (userNode?.parsed ?? {}) as UserOntologyData;
		const profData = (professionalNode?.parsed ?? {}) as ProfessionalProfile;

		return buildFullProfile(eName, profData, userData);
	}

	/** Get profile — serves from 30s cache, falls back to eVault. */
	async getProfile(eName: string): Promise<FullProfile> {
		const now = Date.now();
		const cached = this.cache.get(eName);
		if (cached && cached.expiresAt > now) {
			return cached.profile;
		}

		const profile = await this.fetchFromEvault(eName);
		this.cache.set(eName, {
			profile,
			expiresAt: now + EVaultProfileService.CACHE_TTL,
		});
		return profile;
	}

	async getPublicProfile(eName: string): Promise<FullProfile | null> {
		const profile = await this.getProfile(eName);
		if (!profile.professional.isPublic) {
			return null;
		}
		return profile;
	}

	/**
	 * Prepare a profile update. Reads existing data, merges, returns the
	 * optimistic profile immediately. The eVault write runs as `persisted`.
	 */
	async prepareUpdate(
		eName: string,
		data: Partial<ProfessionalProfile>,
	): Promise<PreparedWrite> {
		console.log(
			`[eVault] ${eName}: prepareUpdate keys=[${Object.keys(data).join(", ")}]`,
		);

		const client = await this.getClient(eName);

		const [existing, userNode] = await Promise.all([
			this.findMetaEnvelopeByOntology(client, PROFESSIONAL_PROFILE_ONTOLOGY),
			this.findMetaEnvelopeByOntology(client, USER_ONTOLOGY),
		]);

		const userData = (userNode?.parsed ?? {}) as UserOntologyData;

		const merged: ProfessionalProfile = {
			...(existing?.parsed as ProfessionalProfile | undefined),
			...data,
		};

		const payload = buildPayload(merged);
		const acl = merged.isPublic === true ? ["*"] : [normalizeEName(eName)];

		console.log(
			`[eVault] ${eName}: payload keys=[${Object.keys(payload).join(", ")}], acl=${JSON.stringify(acl)}`,
		);

		const profile = buildFullProfile(eName, merged, userData);

		// Immediately update the cache with the optimistic result
		this.cache.set(eName, {
			profile,
			expiresAt: Date.now() + EVaultProfileService.CACHE_TTL,
		});

		const persisted = this.writeToEvault(
			client,
			eName,
			existing,
			payload,
			acl,
		);

		return { profile, persisted };
	}

	private async writeToEvault(
		client: GraphQLClient,
		eName: string,
		existing: MetaEnvelopeNode | null,
		payload: Record<string, unknown>,
		acl: string[],
	): Promise<void> {
		try {
			if (existing) {
				const result = await client.request<UpdateResult>(UPDATE_MUTATION, {
					id: existing.id,
					input: {
						ontology: PROFESSIONAL_PROFILE_ONTOLOGY,
						payload,
						acl,
					},
				});

				if (result.updateMetaEnvelope.errors?.length) {
					const errMsg = result.updateMetaEnvelope.errors
						.map((e) => e.message)
						.join("; ");
					console.error(`[eVault] ${eName}: UPDATE failed:`, errMsg);
					throw new Error(errMsg);
				}
				console.log(`[eVault] ${eName}: UPDATE ok`);
			} else {
				const result = await client.request<CreateResult>(CREATE_MUTATION, {
					input: {
						ontology: PROFESSIONAL_PROFILE_ONTOLOGY,
						payload,
						acl,
					},
				});

				if (result.createMetaEnvelope.errors?.length) {
					const errors = result.createMetaEnvelope.errors;
					const couldBeConflict = errors.some(
						(e) =>
							e.code === "CREATE_FAILED" ||
							e.code === "ONTOLOGY_ALREADY_EXISTS",
					);

					if (!couldBeConflict) {
						throw new Error(errors.map((e) => e.message).join("; "));
					}

					const raced = await this.findMetaEnvelopeByOntology(
						client,
						PROFESSIONAL_PROFILE_ONTOLOGY,
					);
					if (raced) {
						const updateResult = await client.request<UpdateResult>(
							UPDATE_MUTATION,
							{
								id: raced.id,
								input: {
									ontology: PROFESSIONAL_PROFILE_ONTOLOGY,
									payload,
									acl,
								},
							},
						);
						if (updateResult.updateMetaEnvelope.errors?.length) {
							throw new Error(
								updateResult.updateMetaEnvelope.errors
									.map((e) => e.message)
									.join("; "),
							);
						}
					} else {
						throw new Error(errors.map((e) => e.message).join("; "));
					}
				} else {
					console.log(`[eVault] ${eName}: CREATE ok`);
				}
			}
		} catch (err) {
			// On write failure, invalidate cache so next read gets fresh data
			this.cache.delete(eName);
			throw err;
		}
	}

	async getProfileByEnvelope(
		eName: string,
		id: string,
	): Promise<MetaEnvelopeNode | null> {
		const client = await this.getClient(eName);
		const result = await client.request<MetaEnvelopeResult>(
			META_ENVELOPE_QUERY,
			{ id },
		);
		return result.metaEnvelope;
	}
}
