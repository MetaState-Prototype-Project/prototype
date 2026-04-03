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
	/** Cached envelope ID so writes don't need a read round-trip. */
	envelopeId?: string;
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
	/** Longer TTL after writes — rides out eVault eventual consistency window. */
	private static WRITE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
	/** Per-user write queue — serializes eVault writes so rapid edits don't race. */
	private writeQueue = new Map<string, Promise<void>>();

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

	/** Fetch profile from eVault (bypasses cache). Returns profile + envelope ID. */
	private async fetchFromEvault(eName: string): Promise<{ profile: FullProfile; envelopeId?: string }> {
		const client = await this.getClient(eName);

		const [professionalNode, userNode] = await Promise.all([
			this.findMetaEnvelopeByOntology(client, PROFESSIONAL_PROFILE_ONTOLOGY),
			this.findMetaEnvelopeByOntology(client, USER_ONTOLOGY),
		]);

		const userData = (userNode?.parsed ?? {}) as UserOntologyData;
		const profData = (professionalNode?.parsed ?? {}) as ProfessionalProfile;

		console.log(
			`[eVault READ] ${eName}: envelopeId=${professionalNode?.id ?? "NONE"} avatarFileId=${profData.avatarFileId ?? "NONE"} bannerFileId=${profData.bannerFileId ?? "NONE"} keys=[${Object.keys(profData).join(",")}]`,
		);

		return {
			profile: buildFullProfile(eName, profData, userData),
			envelopeId: professionalNode?.id,
		};
	}

	/** Get profile — serves from 30s cache, falls back to eVault. */
	async getProfile(eName: string): Promise<FullProfile> {
		const now = Date.now();
		const cached = this.cache.get(eName);
		if (cached && cached.expiresAt > now) {
			const ttl = Math.round((cached.expiresAt - now) / 1000);
			console.log(
				`[eVault CACHE HIT] ${eName}: ttl=${ttl}s avatarFileId=${cached.profile.professional.avatarFileId ?? "NONE"} bannerFileId=${cached.profile.professional.bannerFileId ?? "NONE"}`,
			);
			return cached.profile;
		}

		console.log(`[eVault CACHE MISS] ${eName}: fetching from eVault`);
		const { profile, envelopeId } = await this.fetchFromEvault(eName);
		this.cache.set(eName, {
			profile,
			expiresAt: now + EVaultProfileService.CACHE_TTL,
			envelopeId,
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
	 * Prepare a profile update. Uses the cache as merge base when available
	 * so rapid back-to-back edits don't clobber each other (the eVault write
	 * is async and may not have landed yet). Falls back to eVault if no cache.
	 */
	async prepareUpdate(
		eName: string,
		data: Partial<ProfessionalProfile>,
	): Promise<PreparedWrite> {
		console.log(
			`[eVault] ${eName}: prepareUpdate keys=[${Object.keys(data).join(", ")}]`,
		);

		// Use cache as merge base if available — this prevents a concurrent
		// background write from being clobbered by a stale eVault read.
		const cached = this.cache.get(eName);
		let baseProfessional: ProfessionalProfile;
		let userData: UserOntologyData;
		let cachedEnvelopeId: string | undefined;

		if (cached) {
			baseProfessional = cached.profile.professional;
			userData = {
				displayName: cached.profile.name,
				username: cached.profile.handle,
				isVerified: cached.profile.isVerified,
			} as UserOntologyData;
			cachedEnvelopeId = cached.envelopeId;
			console.log(
				`[eVault MERGE-BASE] ${eName}: FROM CACHE — avatarFileId=${baseProfessional.avatarFileId ?? "NONE"} bannerFileId=${baseProfessional.bannerFileId ?? "NONE"} envelopeId=${cachedEnvelopeId ?? "NONE"}`,
			);
		} else {
			// No cache — must read from eVault
			const { profile, envelopeId } = await this.fetchFromEvault(eName);
			baseProfessional = profile.professional;
			userData = {
				displayName: profile.name,
				username: profile.handle,
				isVerified: profile.isVerified,
			} as UserOntologyData;
			cachedEnvelopeId = envelopeId;
			console.log(
				`[eVault MERGE-BASE] ${eName}: FROM EVAULT — avatarFileId=${baseProfessional.avatarFileId ?? "NONE"} bannerFileId=${baseProfessional.bannerFileId ?? "NONE"} envelopeId=${cachedEnvelopeId ?? "NONE"}`,
			);
		}

		const client = await this.getClient(eName);
		// Build a minimal MetaEnvelopeNode stub for writeToEvault
		const existingEnvelope: MetaEnvelopeNode | null = cachedEnvelopeId
			? { id: cachedEnvelopeId, ontology: PROFESSIONAL_PROFILE_ONTOLOGY, parsed: {} }
			: null;

		const merged: ProfessionalProfile = {
			...baseProfessional,
			...data,
		};

		const payload = buildPayload(merged);
		const acl = merged.isPublic === true ? ["*"] : [normalizeEName(eName)];

		console.log(
			`[eVault MERGED] ${eName}: avatarFileId=${merged.avatarFileId ?? "NONE"} bannerFileId=${merged.bannerFileId ?? "NONE"} payload keys=[${Object.keys(payload).join(", ")}] acl=${JSON.stringify(acl)}`,
		);

		const profile = buildFullProfile(eName, merged, userData);

		// Immediately update the cache with the optimistic result
		this.cache.set(eName, {
			profile,
			expiresAt: Date.now() + EVaultProfileService.CACHE_TTL,
			envelopeId: cachedEnvelopeId,
		});

		const persisted = this.enqueueWrite(eName, () =>
			this.writeToEvault(client, eName, existingEnvelope, payload, acl),
		);

		return { profile, persisted };
	}

	/**
	 * Enqueue a write for a user — ensures writes are serialized so a
	 * slow write #1 can't be overwritten by a fast write #2.
	 */
	private enqueueWrite(
		eName: string,
		fn: () => Promise<void>,
	): Promise<void> {
		const prev = this.writeQueue.get(eName) ?? Promise.resolve();
		const next = prev.then(fn, fn); // run even if previous failed
		this.writeQueue.set(eName, next);
		// Clean up the queue entry when done
		next.finally(() => {
			if (this.writeQueue.get(eName) === next) {
				this.writeQueue.delete(eName);
			}
		});
		return next;
	}

	private async writeToEvault(
		client: GraphQLClient,
		eName: string,
		existing: MetaEnvelopeNode | null,
		payload: Record<string, unknown>,
		acl: string[],
	): Promise<void> {
		console.log(
			`[eVault WRITE] ${eName}: starting ${existing ? "UPDATE" : "CREATE"} envelopeId=${existing?.id ?? "NEW"} avatarFileId=${payload.avatarFileId ?? "NONE"} bannerFileId=${payload.bannerFileId ?? "NONE"}`,
		);

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
					console.error(`[eVault WRITE FAIL] ${eName}: UPDATE errors: ${errMsg}`);
					throw new Error(errMsg);
				}

				const returned = result.updateMetaEnvelope.metaEnvelope?.parsed as Record<string, unknown> | undefined;
				console.log(
					`[eVault WRITE OK] ${eName}: UPDATE response avatarFileId=${returned?.avatarFileId ?? "NONE"} bannerFileId=${returned?.bannerFileId ?? "NONE"} keys=[${returned ? Object.keys(returned).join(",") : "EMPTY"}]`,
				);
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
					console.warn(`[eVault WRITE] ${eName}: CREATE got errors: ${JSON.stringify(errors)}`);
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
						console.log(`[eVault WRITE] ${eName}: CREATE conflict, falling back to UPDATE on ${raced.id}`);
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
						const returned = updateResult.updateMetaEnvelope.metaEnvelope?.parsed as Record<string, unknown> | undefined;
						console.log(
							`[eVault WRITE OK] ${eName}: fallback UPDATE response avatarFileId=${returned?.avatarFileId ?? "NONE"}`,
						);
					} else {
						throw new Error(errors.map((e) => e.message).join("; "));
					}
				} else {
					const returned = result.createMetaEnvelope.metaEnvelope?.parsed as Record<string, unknown> | undefined;
					console.log(
						`[eVault WRITE OK] ${eName}: CREATE response avatarFileId=${returned?.avatarFileId ?? "NONE"} bannerFileId=${returned?.bannerFileId ?? "NONE"}`,
					);
				}
			}

			// Write succeeded — extend the cache with a long TTL so we ride out
			// eVault's eventual-consistency window instead of reading stale data.
			const cached = this.cache.get(eName);
			if (cached) {
				cached.expiresAt = Date.now() + EVaultProfileService.WRITE_CACHE_TTL;
				console.log(`[eVault CACHE PIN] ${eName}: extended cache TTL to ${EVaultProfileService.WRITE_CACHE_TTL / 1000}s after successful write`);
			}
		} catch (err) {
			// On write failure, invalidate cache so next read gets fresh data
			console.error(`[eVault WRITE FAIL] ${eName}: invalidating cache`, (err as Error).message);
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
