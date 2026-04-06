import { GraphQLClient } from "graphql-request";
import { RegistryService } from "./RegistryService";
import type {
	ProfessionalProfile,
	FullProfile,
	UserOntologyData,
} from "../types/profile";

const PROFESSIONAL_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440009";
const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

function getFileManagerPublicUrl(fileId: string): string {
	const base = process.env.PUBLIC_FILE_MANAGER_BASE_URL || "http://localhost:3005";
	return `${base}/api/public/files/${fileId}`;
}

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

async function getLocalUser(eName: string) {
	const { AppDataSource } = await import("../database/data-source");
	const { User } = await import("../database/entities/User");
	const repo = AppDataSource.getRepository(User);
	return { repo, user: await repo.findOneBy({ ename: eName }), User };
}

function buildFullProfile(
	eName: string,
	merged: ProfessionalProfile,
	userData: UserOntologyData,
	localAvatar?: string,
	localBanner?: string,
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
			avatar: localAvatar ?? undefined,
			banner: localBanner ?? undefined,
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
	private cache = new Map<string, CacheEntry>();
	private static CACHE_TTL = 30 * 1000;
	private static WRITE_CACHE_TTL = 5 * 60 * 1000;
	private writeQueue = new Map<string, Promise<void>>();

	constructor(registryService: RegistryService) {
		this.registryService = registryService;
	}

	private async getClient(eName: string): Promise<GraphQLClient> {
		const t0 = Date.now();
		const endpoint = await this.registryService.getEvaultGraphqlUrl(eName);
		const t1 = Date.now();
		const token = await this.registryService.ensurePlatformToken();
		const t2 = Date.now();
		if (t2 - t0 > 50) {
			console.log(`[eVault] getClient ${eName}: resolve=${t1 - t0}ms token=${t2 - t1}ms`);
		}
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

		// Avatar/banner live on the local User entity (file-manager IDs)
		const { user: localUser } = await getLocalUser(eName);

		return {
			profile: buildFullProfile(eName, profData, userData, localUser?.avatar, localUser?.banner),
			envelopeId: professionalNode?.id,
		};
	}

	/** Get profile — serves from 30s cache, falls back to eVault. */
	async getProfile(eName: string): Promise<FullProfile> {
		const now = Date.now();
		const cached = this.cache.get(eName);
		if (cached && cached.expiresAt > now) {
			return cached.profile;
		}

		const { profile, envelopeId } = await this.fetchFromEvault(eName);
		this.cache.set(eName, {
			profile,
			expiresAt: now + EVaultProfileService.CACHE_TTL,
			envelopeId,
		});
		return profile;
	}

	/** Get profile fresh from eVault — bypasses cache, but updates it. */
	async getFreshProfile(eName: string): Promise<FullProfile> {
		const { profile, envelopeId } = await this.fetchFromEvault(eName);
		this.cache.set(eName, {
			profile,
			expiresAt: Date.now() + EVaultProfileService.CACHE_TTL,
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
	 * so rapid back-to-back edits don't clobber each other.
	 */
	async prepareUpdate(
		eName: string,
		data: Partial<ProfessionalProfile>,
	): Promise<PreparedWrite> {
		// Persist avatar/banner to the local User row immediately so
		// getProfile returns the correct value right away.
		if (data.avatar !== undefined || data.banner !== undefined) {
			const { repo, user: localUser, User } = await getLocalUser(eName);
			const u = localUser ?? repo.create({ ename: eName });
			if (data.avatar !== undefined) u.avatar = data.avatar;
			if (data.banner !== undefined) u.banner = data.banner;
			await repo.save(u);

			// Mark new avatar/banner files as publicly accessible
			const { markFilePublic } = await import("../utils/file-proxy");
			if (data.avatar) markFilePublic(data.avatar, eName).catch(() => {});
			if (data.banner) markFilePublic(data.banner, eName).catch(() => {});
		}

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
		} else {
			const { profile, envelopeId } = await this.fetchFromEvault(eName);
			baseProfessional = profile.professional;
			userData = {
				displayName: profile.name,
				username: profile.handle,
				isVerified: profile.isVerified,
			} as UserOntologyData;
			cachedEnvelopeId = envelopeId;
		}

		const client = await this.getClient(eName);
		const existingEnvelope: MetaEnvelopeNode | null = cachedEnvelopeId
			? { id: cachedEnvelopeId, ontology: PROFESSIONAL_PROFILE_ONTOLOGY, parsed: {} }
			: null;

		const merged: ProfessionalProfile = {
			...baseProfessional,
			...data,
		};

		const payload = buildPayload(merged);
		const acl = merged.isPublic === true ? ["*"] : [normalizeEName(eName)];

		// Read local user for the optimistic profile (may have just been updated above)
		const { user: freshLocalUser } = await getLocalUser(eName);
		const profile = buildFullProfile(eName, merged, userData, freshLocalUser?.avatar, freshLocalUser?.banner);

		// Immediately update the cache with the optimistic result
		this.cache.set(eName, {
			profile,
			expiresAt: Date.now() + EVaultProfileService.CACHE_TTL,
			envelopeId: cachedEnvelopeId,
		});

		const persisted = this.enqueueWrite(eName, async () => {
			await this.writeToEvault(client, eName, existingEnvelope, payload, acl);
			// After eVault write, sync avatar/banner URLs to User ontology
			if (data.avatar !== undefined || data.banner !== undefined) {
				await this.syncAvatarBannerToUserOntology(client, eName, merged);
			}
		});

		return { profile, persisted };
	}

	private enqueueWrite(
		eName: string,
		fn: () => Promise<void>,
	): Promise<void> {
		const prev = this.writeQueue.get(eName) ?? Promise.resolve();
		const next = prev.then(fn, fn);
		this.writeQueue.set(eName, next);
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
					throw new Error(
						result.updateMetaEnvelope.errors
							.map((e) => e.message)
							.join("; "),
					);
				}
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
				}
			}

			// Write succeeded — extend the cache TTL
			const cached = this.cache.get(eName);
			if (cached) {
				cached.expiresAt = Date.now() + EVaultProfileService.WRITE_CACHE_TTL;
			}
		} catch (err) {
			console.error(`[eVault WRITE FAIL] ${eName}: invalidating cache`, (err as Error).message);
			this.cache.delete(eName);
			throw err;
		}
	}

	/**
	 * Writes avatarUrl / bannerUrl as public file-manager URLs into the
	 * User ontology so other platforms can render them directly.
	 */
	private async syncAvatarBannerToUserOntology(
		client: GraphQLClient,
		eName: string,
		profile: ProfessionalProfile,
	): Promise<void> {
		try {
			const userNode = await this.findMetaEnvelopeByOntology(client, USER_ONTOLOGY);
			const existing = (userNode?.parsed ?? {}) as Record<string, unknown>;
			// Preserve the existing ACL; only default to public for new envelopes
			const existingAcl = (userNode as any)?.acl;

			// Only patch avatarUrl/bannerUrl — don't overwrite other User fields
			const patch: Record<string, unknown> = { ...existing };
			if (profile.avatar) {
				patch.avatarUrl = getFileManagerPublicUrl(profile.avatar);
			}
			if (profile.banner) {
				patch.bannerUrl = getFileManagerPublicUrl(profile.banner);
			}

			if (userNode) {
				await client.request<UpdateResult>(UPDATE_MUTATION, {
					id: userNode.id,
					input: {
						ontology: USER_ONTOLOGY,
						payload: patch,
						acl: existingAcl ?? ["*"],
					},
				});
			} else {
				patch.ename = eName;
				patch.displayName = profile.displayName ?? eName;
				await client.request<CreateResult>(CREATE_MUTATION, {
					input: { ontology: USER_ONTOLOGY, payload: patch, acl: ["*"] },
				});
			}
		} catch (e) {
			console.error("Failed to sync avatar/banner to User ontology:", e);
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
