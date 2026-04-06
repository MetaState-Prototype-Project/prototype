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

	async getProfile(eName: string): Promise<FullProfile> {
		const client = await this.getClient(eName);

		const [professionalNode, userNode] = await Promise.all([
			this.findMetaEnvelopeByOntology(client, PROFESSIONAL_PROFILE_ONTOLOGY),
			this.findMetaEnvelopeByOntology(client, USER_ONTOLOGY),
		]);

		const userData = (userNode?.parsed ?? {}) as UserOntologyData;
		const profData = (professionalNode?.parsed ?? {}) as ProfessionalProfile;

		// Avatar/banner live on the local User entity (file-manager IDs),
		// not in any eVault ontology.
		const { AppDataSource } = await import("../database/data-source");
		const { User } = await import("../database/entities/User");
		const localUser = await AppDataSource.getRepository(User).findOneBy({ ename: eName });

		const name =
			profData.displayName ?? userData.displayName ?? eName;

		return {
			ename: eName,
			name,
			handle: userData.username,
			isVerified: userData.isVerified,
			professional: {
				displayName: profData.displayName,
				headline: profData.headline,
				bio: profData.bio,
				avatar: localUser?.avatar ?? undefined,
				banner: localUser?.banner ?? undefined,
				cvFileId: profData.cvFileId,
				videoIntroFileId: profData.videoIntroFileId,
				email: profData.email,
				phone: profData.phone,
				website: profData.website,
				location: profData.location,
				isPublic: profData.isPublic === true, // default to public when not explicitly set
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

	async upsertProfile(
		eName: string,
		data: Partial<ProfessionalProfile>,
	): Promise<FullProfile> {
		const client = await this.getClient(eName);

		const existing = await this.findMetaEnvelopeByOntology(
			client,
			PROFESSIONAL_PROFILE_ONTOLOGY,
		);

	const merged: ProfessionalProfile = {
		...(existing?.parsed as ProfessionalProfile | undefined),
		...data,
	};

	const acl = merged.isPublic === true ? ["*"] : [normalizeEName(eName)];

	if (existing) {
		const result = await client.request<UpdateResult>(UPDATE_MUTATION, {
			id: existing.id,
			input: {
				ontology: PROFESSIONAL_PROFILE_ONTOLOGY,
				payload: merged,
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
				payload: merged,
				acl,
			},
		});

		if (result.createMetaEnvelope.errors?.length) {
			const errors = result.createMetaEnvelope.errors;
			const couldBeConflict = errors.some(
				(e) => e.code === "CREATE_FAILED" || e.code === "ONTOLOGY_ALREADY_EXISTS",
			);

			if (!couldBeConflict) {
				throw new Error(errors.map((e) => e.message).join("; "));
			}

			// Re-query in case a concurrent create won the race (TOCTOU)
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
							payload: merged,
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
				// No existing envelope found — this wasn't a conflict, surface original errors
				throw new Error(errors.map((e) => e.message).join("; "));
			}
		}
	}

		// Always persist avatar/banner to the local User row first so
		// getProfile returns the correct value immediately.
		if (data.avatar !== undefined || data.banner !== undefined) {
			const { AppDataSource } = await import("../database/data-source");
			const { User } = await import("../database/entities/User");
			const userRepo = AppDataSource.getRepository(User);
			let localUser = await userRepo.findOneBy({ ename: eName });
			if (!localUser) {
				localUser = userRepo.create({ ename: eName });
			}
			if (data.avatar !== undefined) localUser.avatar = data.avatar;
			if (data.banner !== undefined) localUser.banner = data.banner;
			await userRepo.save(localUser);

			// Propagate a public file-manager URL to the User ontology so
			// other platforms (Pictique, Blabsy, etc.) pick it up.
			this.syncAvatarBannerToUserOntology(client, eName, merged).catch(
				(e) => console.error("Failed to sync avatar/banner to User ontology:", e),
			);
		}

		return this.getProfile(eName);
	}

	/**
	 * Writes avatarUrl / bannerUrl as public file-manager URLs into the
	 * User ontology MetaEnvelope so other platforms can render them directly.
	 * Also updates the local User entity so the DB stays in sync.
	 */
	private async syncAvatarBannerToUserOntology(
		client: GraphQLClient,
		eName: string,
		profile: ProfessionalProfile,
	): Promise<void> {
		try {
			const userNode = await this.findMetaEnvelopeByOntology(client, USER_ONTOLOGY);
			const existing = (userNode?.parsed ?? {}) as Record<string, unknown>;

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
					input: { ontology: USER_ONTOLOGY, payload: patch, acl: ["*"] },
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
