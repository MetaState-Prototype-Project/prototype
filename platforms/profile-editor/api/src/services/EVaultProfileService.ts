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

function isEmpty(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === "string" && value.length === 0) return true;
	if (Array.isArray(value) && value.length === 0) return true;
	if (typeof value === "object" && Object.keys(value as object).length === 0) return true;
	return false;
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

const DELETE_MUTATION = `
  mutation DeleteMetaEnvelope($id: String!) {
    deleteMetaEnvelope(id: $id)
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
	// avatarUrl/bannerUrl belong in the User Ontology envelope, not the
	// Professional Profile — keep them off this payload.
	const skip = new Set(["avatarUrl", "bannerUrl"]);
	for (const [key, value] of Object.entries(merged)) {
		if (skip.has(key)) continue;
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
			avatarUrl: userData.avatarUrl,
			bannerUrl: userData.bannerUrl,
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

	/**
	 * Find the canonical envelope for an ontology. If duplicates exist,
	 * merge their `parsed` payloads into one winner (the first edge —
	 * cursor-ordered, typically the oldest) and delete the rest. The
	 * winner's existing values take precedence; loser values only fill
	 * in keys the winner had empty/null/missing, so no data is lost.
	 *
	 * Best-effort: a delete or merge-update failure is logged and
	 * swallowed so reads keep working with the winner.
	 */
	private async findMetaEnvelopeByOntology(
		client: GraphQLClient,
		ontologyId: string,
	): Promise<MetaEnvelopeNode | null> {
		const result = await client.request<MetaEnvelopesResult>(
			META_ENVELOPES_QUERY,
			{
				filter: { ontologyId },
				first: 50,
			},
		);

		const edges = result.metaEnvelopes.edges;
		if (edges.length === 0) return null;
		if (edges.length === 1) return edges[0].node;

		const winner = edges[0].node;
		const losers = edges.slice(1).map((e) => e.node);
		console.warn(
			`[eVault] DUPLICATE ENVELOPES: ${edges.length} for ontology ${ontologyId} — consolidating into ${winner.id}, deleting ${losers.length}`,
		);

		const merged: Record<string, unknown> = { ...winner.parsed };
		for (const loser of losers) {
			for (const [key, value] of Object.entries(loser.parsed ?? {})) {
				if (isEmpty(merged[key]) && !isEmpty(value)) {
					merged[key] = value;
				}
			}
		}

		// If merge added anything beyond the winner, persist it before
		// deleting losers so we don't lose data on a partial failure.
		const winnerKeys = Object.keys(winner.parsed ?? {});
		const mergedKeys = Object.keys(merged);
		const addedKeys = mergedKeys.filter((k) => !winnerKeys.includes(k) || isEmpty(winner.parsed?.[k]));
		if (addedKeys.length > 0) {
			try {
				await client.request<UpdateResult>(UPDATE_MUTATION, {
					id: winner.id,
					input: { ontology: ontologyId, payload: merged, acl: ["*"] },
				});
				winner.parsed = merged;
			} catch (e: any) {
				console.error(
					`[eVault] consolidate-merge failed for ${ontologyId} winner=${winner.id}:`,
					e.message,
				);
			}
		}

		for (const loser of losers) {
			try {
				await client.request<{ deleteMetaEnvelope: boolean }>(DELETE_MUTATION, {
					id: loser.id,
				});
			} catch (e: any) {
				console.error(
					`[eVault] consolidate-delete failed for ${ontologyId} loser=${loser.id}:`,
					e.message,
				);
			}
		}

		return winner;
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
				avatarUrl: cached.profile.professional.avatarUrl,
				bannerUrl: cached.profile.professional.bannerUrl,
			} as UserOntologyData;
			cachedEnvelopeId = cached.envelopeId;
		} else {
			const { profile, envelopeId } = await this.fetchFromEvault(eName);
			baseProfessional = profile.professional;
			userData = {
				displayName: profile.name,
				username: profile.handle,
				isVerified: profile.isVerified,
				avatarUrl: profile.professional.avatarUrl,
				bannerUrl: profile.professional.bannerUrl,
			} as UserOntologyData;
			cachedEnvelopeId = envelopeId;
		}

		// Optimistically reflect the new avatarUrl/bannerUrl in the response
		// so the editor sees them right after upload, before the queued
		// User Ontology write lands.
		if (data.avatarUrl !== undefined) {
			userData.avatarUrl = data.avatarUrl;
		}
		if (data.bannerUrl !== undefined) {
			userData.bannerUrl = data.bannerUrl;
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

		const profile = buildFullProfile(eName, merged, userData);

		// Immediately update the cache with the optimistic result
		this.cache.set(eName, {
			profile,
			expiresAt: Date.now() + EVaultProfileService.CACHE_TTL,
			envelopeId: cachedEnvelopeId,
		});

		const persisted = this.enqueueWrite(eName, async () => {
			await this.writeToEvault(client, eName, existingEnvelope, payload, acl);
			// avatarUrl/bannerUrl live in the User Ontology, not the
			// Professional Profile envelope.
			if (data.avatarUrl !== undefined || data.bannerUrl !== undefined) {
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
	 * Errors propagate — the User Ontology is the canonical source for
	 * avatarUrl/bannerUrl per the schema, and a silent failure here
	 * leaves consumers with stale URLs.
	 */
	private async syncAvatarBannerToUserOntology(
		client: GraphQLClient,
		eName: string,
		profile: ProfessionalProfile,
	): Promise<void> {
		const userNode = await this.findMetaEnvelopeByOntology(client, USER_ONTOLOGY);
		const existing = (userNode?.parsed ?? {}) as Record<string, unknown>;
		const existingAcl = (userNode as any)?.acl;

		const patch: Record<string, unknown> = { ...existing };
		if (profile.avatarUrl !== undefined) {
			patch.avatarUrl = profile.avatarUrl;
		}
		if (profile.bannerUrl !== undefined) {
			patch.bannerUrl = profile.bannerUrl;
		}

		if (userNode) {
			const result = await client.request<UpdateResult>(UPDATE_MUTATION, {
				id: userNode.id,
				input: {
					ontology: USER_ONTOLOGY,
					payload: patch,
					acl: existingAcl ?? ["*"],
				},
			});
			if (result.updateMetaEnvelope.errors?.length) {
				throw new Error(
					"User ontology update failed: " +
						result.updateMetaEnvelope.errors.map((e) => e.message).join("; "),
				);
			}
		} else {
			patch.ename = eName;
			patch.displayName = profile.displayName ?? eName;
			const result = await client.request<CreateResult>(CREATE_MUTATION, {
				input: { ontology: USER_ONTOLOGY, payload: patch, acl: ["*"] },
			});
			if (result.createMetaEnvelope.errors?.length) {
				throw new Error(
					"User ontology create failed: " +
						result.createMetaEnvelope.errors.map((e) => e.message).join("; "),
				);
			}
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
