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
				first: 1,
			},
		);
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
	 * returns the freshly-read profile. Fully blocking — no fire-and-forget.
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

		const existing = await this.findMetaEnvelopeByOntology(
			client,
			PROFESSIONAL_PROFILE_ONTOLOGY,
		);

		console.log(
			`[eVault write] ${eName}: existing envelope ${existing ? `found (id=${existing.id})` : "NOT found — will create"}`,
		);

		const merged: ProfessionalProfile = {
			...(existing?.parsed as ProfessionalProfile | undefined),
			...data,
		};

		const acl = merged.isPublic === true ? ["*"] : [normalizeEName(eName)];
		console.log(
			`[eVault write] ${eName}: merged payload isPublic=${merged.isPublic}, acl=${JSON.stringify(acl)}`,
		);

		if (existing) {
			console.log(`[eVault write] ${eName}: sending UPDATE mutation...`);
			const result = await client.request<UpdateResult>(UPDATE_MUTATION, {
				id: existing.id,
				input: {
					ontology: PROFESSIONAL_PROFILE_ONTOLOGY,
					payload: merged,
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
					payload: merged,
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
								payload: merged,
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

		// Re-read from eVault to return the canonical state
		console.log(`[eVault write] ${eName}: re-reading profile after write...`);
		const profile = await this.getProfile(eName);
		if ("education" in data) {
			console.log(
				`[eVault write] ${eName}: after write, eVault has ${profile.professional.education?.length ?? 0} education entries`,
			);
		}
		if ("isPublic" in data) {
			console.log(
				`[eVault write] ${eName}: after write, eVault has isPublic=${profile.professional.isPublic}`,
			);
		}
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
