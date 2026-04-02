import { GraphQLClient } from "graphql-request";
import { RegistryService } from "./RegistryService";
import type {
	ProfessionalProfile,
	FullProfile,
	UserOntologyData,
} from "../types/profile";

const PROFESSIONAL_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440009";
const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

/** Match BindingDocumentService's normalizeSubject format for ACL entries */
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

export class EVaultProfileService {
	private registryService: RegistryService;

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
				`[eVault] DUPLICATE ENVELOPES: found ${result.metaEnvelopes.totalCount} envelopes for ontology ${ontologyId}. IDs: ${result.metaEnvelopes.edges.map((e) => e.node.id).join(", ")}`,
			);
		}
		const edge = result.metaEnvelopes.edges[0];
		return edge?.node ?? null;
	}

	/** Fetch profile directly from eVault. No caching. */
	async getProfile(eName: string): Promise<FullProfile> {
		const client = await this.getClient(eName);

		const [professionalNode, userNode] = await Promise.all([
			this.findMetaEnvelopeByOntology(client, PROFESSIONAL_PROFILE_ONTOLOGY),
			this.findMetaEnvelopeByOntology(client, USER_ONTOLOGY),
		]);

		const userData = (userNode?.parsed ?? {}) as UserOntologyData;
		const profData = (professionalNode?.parsed ?? {}) as ProfessionalProfile;

		const name = profData.displayName ?? userData.displayName ?? eName;

		return {
			ename: eName,
			name,
			handle: userData.username,
			isVerified: userData.isVerified,
			professional: {
				displayName: profData.displayName,
				headline: profData.headline,
				bio: profData.bio,
				avatarFileId: profData.avatarFileId,
				bannerFileId: profData.bannerFileId,
				cvFileId: profData.cvFileId,
				videoIntroFileId: profData.videoIntroFileId,
				email: profData.email,
				phone: profData.phone,
				website: profData.website,
				location: profData.location,
				isPublic: profData.isPublic === true,
				workExperience: profData.workExperience ?? [],
				education: profData.education ?? [],
				skills: profData.skills ?? [],
				socialLinks: profData.socialLinks ?? [],
			},
		};
	}

	async getPublicProfile(eName: string): Promise<FullProfile | null> {
		const profile = await this.getProfile(eName);
		if (!profile.professional.isPublic) {
			return null;
		}
		return profile;
	}

	/**
	 * Write a partial update to eVault. Merges with existing data, writes, and
	 * returns the merged profile directly (no re-read — eVault is eventually
	 * consistent so a read-after-write can return stale data).
	 */
	async upsertProfile(
		eName: string,
		data: Partial<ProfessionalProfile>,
	): Promise<FullProfile> {
		console.log(
			`[eVault write] ${eName}: upsertProfile called with keys: [${Object.keys(data).join(", ")}]`,
		);
		if ("education" in data) {
			console.log(
				`[eVault write] ${eName}: education payload has ${(data.education ?? []).length} entries`,
			);
		}
		if ("isPublic" in data) {
			console.log(
				`[eVault write] ${eName}: visibility change → isPublic=${data.isPublic}`,
			);
		}

		const client = await this.getClient(eName);

		// Fetch both ontologies so we can build the full profile to return
		const [existing, userNode] = await Promise.all([
			this.findMetaEnvelopeByOntology(client, PROFESSIONAL_PROFILE_ONTOLOGY),
			this.findMetaEnvelopeByOntology(client, USER_ONTOLOGY),
		]);

		const userData = (userNode?.parsed ?? {}) as UserOntologyData;

		console.log(
			`[eVault write] ${eName}: existing envelope ${existing ? `found (id=${existing.id})` : "NOT found — will create"}`,
		);
		if (existing) {
			const existingParsed = existing.parsed as Record<string, unknown>;
			console.log(
				`[eVault write] ${eName}: existing parsed keys=[${Object.keys(existingParsed).join(", ")}]`,
			);
			if ("education" in data) {
				console.log(
					`[eVault write] ${eName}: existing education=${JSON.stringify(existingParsed.education)}`,
				);
			}
		}

		const merged: ProfessionalProfile = {
			...(existing?.parsed as ProfessionalProfile | undefined),
			...data,
		};

		// The eVault stores each payload field as a separate Envelope node.
		// serializeValue([]) doesn't JSON-stringify empty arrays, so Neo4j
		// can't properly overwrite the existing value.  Instead, strip empty
		// arrays (and null/undefined) from the payload — the eVault will
		// DELETE the corresponding Envelope nodes, and reads default to [].
		const payload: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(merged)) {
			if (value === null || value === undefined) continue;
			if (Array.isArray(value) && value.length === 0) continue;
			payload[key] = value;
		}

		const acl = merged.isPublic === true ? ["*"] : [normalizeEName(eName)];
		console.log(
			`[eVault write] ${eName}: merged isPublic=${merged.isPublic}, acl=${JSON.stringify(acl)}, education=${(merged.education ?? []).length} entries, payload keys=[${Object.keys(payload).join(", ")}]`,
		);

		if (existing) {
			console.log(`[eVault write] ${eName}: sending UPDATE mutation...`);
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
				console.error(
					`[eVault write] ${eName}: UPDATE failed:`,
					result.updateMetaEnvelope.errors,
				);
				throw new Error(errMsg);
			}
			console.log(`[eVault write] ${eName}: UPDATE succeeded`);
		} else {
			console.log(`[eVault write] ${eName}: sending CREATE mutation...`);
			const result = await client.request<CreateResult>(CREATE_MUTATION, {
				input: {
					ontology: PROFESSIONAL_PROFILE_ONTOLOGY,
					payload,
					acl,
				},
			});

			if (result.createMetaEnvelope.errors?.length) {
				const errors = result.createMetaEnvelope.errors;
				console.error(
					`[eVault write] ${eName}: CREATE returned errors:`,
					errors,
				);
				const couldBeConflict = errors.some(
					(e) =>
						e.code === "CREATE_FAILED" ||
						e.code === "ONTOLOGY_ALREADY_EXISTS",
				);

				if (!couldBeConflict) {
					throw new Error(errors.map((e) => e.message).join("; "));
				}

				console.log(
					`[eVault write] ${eName}: possible race conflict — re-querying...`,
				);
				const raced = await this.findMetaEnvelopeByOntology(
					client,
					PROFESSIONAL_PROFILE_ONTOLOGY,
				);
				if (raced) {
					console.log(
						`[eVault write] ${eName}: found raced envelope (id=${raced.id}), sending UPDATE...`,
					);
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
						console.error(
							`[eVault write] ${eName}: race-recovery UPDATE failed:`,
							updateResult.updateMetaEnvelope.errors,
						);
						throw new Error(
							updateResult.updateMetaEnvelope.errors
								.map((e) => e.message)
								.join("; "),
						);
					}
					console.log(
						`[eVault write] ${eName}: race-recovery UPDATE succeeded`,
					);
				} else {
					throw new Error(errors.map((e) => e.message).join("; "));
				}
			} else {
				console.log(`[eVault write] ${eName}: CREATE succeeded`);
			}
		}

		// Return the merged state directly. Do NOT re-read from eVault — it is
		// eventually consistent and a read-after-write returns stale data.
		const name = merged.displayName ?? userData.displayName ?? eName;
		const profile: FullProfile = {
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
		console.log(
			`[eVault write] ${eName}: returning profile with education=${profile.professional.education?.length ?? 0}, isPublic=${profile.professional.isPublic}`,
		);
		return profile;
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
