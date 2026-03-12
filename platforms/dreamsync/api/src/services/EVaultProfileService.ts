import { GraphQLClient } from "graphql-request";
import { RegistryService } from "./RegistryService";
import type {
    ProfessionalProfile,
    FullProfile,
    UserOntologyData,
} from "../types/profile";

const PROFESSIONAL_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440009";
/** User/UserProfile ontology UUID (from user.json schema) - eVault stores this, not "User" */
const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

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
        const w3id = this.registryService.normalizeW3id(eName);
        const endpoint = await this.registryService.getEvaultGraphqlUrl(eName);
        const token = await this.registryService.ensurePlatformToken();
        return new GraphQLClient(endpoint, {
            headers: {
                Authorization: `Bearer ${token}`,
                "X-ENAME": w3id,
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

    async getProfessionalProfile(eName: string): Promise<ProfessionalProfile> {
        const client = await this.getClient(eName);
        const node = await this.findMetaEnvelopeByOntology(
            client,
            PROFESSIONAL_PROFILE_ONTOLOGY,
        );
        if (!node) {
            return {};
        }
        return node.parsed as ProfessionalProfile;
    }

    async getProfile(eName: string): Promise<FullProfile> {
        const client = await this.getClient(eName);

        const [professionalNode, userNode] = await Promise.all([
            this.findMetaEnvelopeByOntology(client, PROFESSIONAL_PROFILE_ONTOLOGY),
            this.findMetaEnvelopeByOntology(client, USER_ONTOLOGY),
        ]);

        const userData = (userNode?.parsed ?? {}) as UserOntologyData;
        const profData = (professionalNode?.parsed ?? {}) as ProfessionalProfile;

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
                avatarFileId: profData.avatarFileId,
                bannerFileId: profData.bannerFileId,
                cvFileId: profData.cvFileId,
                videoIntroFileId: profData.videoIntroFileId,
                email: profData.email,
                phone: profData.phone,
                website: profData.website,
                location: profData.location,
                isPublic: profData.isPublic ?? true,
                isDreamsyncVisible: profData.isDreamsyncVisible ?? true,
                workExperience: profData.workExperience ?? [],
                education: profData.education ?? [],
                skills: profData.skills ?? [],
                socialLinks: profData.socialLinks ?? [],
            },
        };
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

        const acl = merged.isPublic !== false ? ["*"] : [eName];

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
                throw new Error(
                    result.createMetaEnvelope.errors
                        .map((e) => e.message)
                        .join("; "),
                );
            }
        }

        return this.getProfile(eName);
    }
}
