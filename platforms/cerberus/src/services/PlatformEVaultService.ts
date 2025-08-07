import axios from "axios";
import { GraphQLClient } from "graphql-request";
import { v4 as uuidv4 } from "uuid";
import { UserEVaultMapping } from "../database/entities/UserEVaultMapping";
import { AppDataSource } from "../database/data-source";

const STORE_META_ENVELOPE = `
  mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
    storeMetaEnvelope(input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
    }
  }
`;

interface MetaEnvelopeResponse {
    storeMetaEnvelope: {
        metaEnvelope: {
            id: string;
            ontology: string;
            parsed: any;
        };
    };
}

interface PlatformProfile {
    platformName: string;
    displayName: string;
    description: string;
    version: string;
    ename: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    isArchived: boolean;
}

export class PlatformEVaultService {
    private static instance: PlatformEVaultService;
    private client: GraphQLClient | null = null;
    private endpoint: string | null = null;

    private constructor() {}

    public static getInstance(): PlatformEVaultService {
        if (!PlatformEVaultService.instance) {
            PlatformEVaultService.instance = new PlatformEVaultService();
        }
        return PlatformEVaultService.instance;
    }

    /**
     * Check if Cerberus platform eVault already exists
     */
    async checkPlatformEVaultExists(): Promise<boolean> {
        const mappingRepository = AppDataSource.getRepository(UserEVaultMapping);
        const existingMapping = await mappingRepository.findOne({
            where: { localUserId: "cerberus-platform" }
        });
        return !!existingMapping;
    }

    /**
     * Create eVault for Cerberus platform (one-time setup)
     */
    async createPlatformEVault(): Promise<{
        w3id: string;
        uri: string;
        userProfileId: string;
    }> {
        console.log("Creating platform eVault for Cerberus...");

        // Check if platform eVault already exists
        const exists = await this.checkPlatformEVaultExists();
        if (exists) {
            throw new Error("Platform eVault already exists for Cerberus");
        }

        try {
            // Step 1: Get entropy from registry
            const registryUrl = process.env.PUBLIC_REGISTRY_URL || "http://localhost:3000";
            const { data: { token: registryEntropy } } = await axios.get(
                new URL("/entropy", registryUrl).toString()
            );

            // Step 2: Provision eVault
            const provisionerUrl = process.env.PUBLIC_PROVISIONER_URL || "http://localhost:3001";
            const verificationId = process.env.DEMO_VERIFICATION_CODE || "d66b7138-538a-465f-a6ce-f6985854c3f4";
            
            const { data } = await axios.post(
                new URL("/provision", provisionerUrl).toString(),
                {
                    registryEntropy,
                    namespace: uuidv4(),
                    verificationId,
                }
            );

            if (!data || data.success !== true) {
                throw new Error("Failed to provision platform eVault");
            }

            const { w3id, uri } = data;

            // Step 3: Create PlatformProfile in eVault
            const userProfileId = await this.createPlatformProfileInEVault(w3id, uri);

            // Step 4: Store mapping in database
            const mappingRepository = AppDataSource.getRepository(UserEVaultMapping);
            const mapping = new UserEVaultMapping();
            mapping.localUserId = "cerberus-platform";
            mapping.evaultW3id = w3id;
            mapping.evaultUri = uri;
            mapping.userProfileId = userProfileId;
            mapping.userProfileData = {
                platformName: "cerberus",
                displayName: "Cerberus Platform",
                description: "Cerberus - Secure messaging and group management platform",
                version: "1.0.0"
            };

            await mappingRepository.save(mapping);

            console.log("Platform eVault created successfully:", { w3id, uri, userProfileId });

            return { w3id, uri, userProfileId };

        } catch (error) {
            console.error("Failed to create platform eVault:", error);
            throw error;
        }
    }

    /**
     * Resolve eVault endpoint from registry
     */
    private async resolveEndpoint(w3id: string): Promise<string> {
        try {
            const registryUrl = process.env.PUBLIC_REGISTRY_URL || "http://localhost:3000";
            const response = await axios.get(
                new URL(`resolve?w3id=${w3id}`, registryUrl).toString()
            );
            return new URL("/graphql", response.data.uri).toString();
        } catch (error) {
            console.error("Error resolving eVault endpoint:", error);
            throw new Error("Failed to resolve eVault endpoint");
        }
    }

    /**
     * Ensure we have a valid GraphQL client
     */
    private async ensureClient(w3id: string): Promise<GraphQLClient> {
        if (!this.endpoint || !this.client) {
            this.endpoint = await this.resolveEndpoint(w3id);
            this.client = new GraphQLClient(this.endpoint);
        }
        return this.client;
    }

    /**
     * Create PlatformProfile in eVault with retry mechanism
     */
    private async createPlatformProfileInEVault(
        w3id: string,
        uri: string,
        maxRetries = 20
    ): Promise<string> {
        console.log("Creating PlatformProfile in eVault...");
        
        const now = new Date().toISOString();
        const platformProfile: PlatformProfile = {
            platformName: "cerberus",
            displayName: "Cerberus Platform",
            description: "Cerberus - Secure messaging and group management platform",
            version: "1.0.0",
            ename: w3id,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            isArchived: false,
        };

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const client = await this.ensureClient(w3id);

                console.log(
                    `Attempting to create PlatformProfile in eVault (attempt ${attempt}/${maxRetries})`
                );

                const response = await client.request<MetaEnvelopeResponse>(
                    STORE_META_ENVELOPE,
                    {
                        input: {
                            ontology: "550e8400-e29b-41d4-a716-446655440000", // UserProfile ontology
                            payload: platformProfile,
                            acl: ["*"],
                        },
                    }
                );

                const userProfileId = response.storeMetaEnvelope.metaEnvelope.id;
                console.log("PlatformProfile created successfully in eVault:", userProfileId);
                return userProfileId;

            } catch (error) {
                console.error(
                    `Failed to create PlatformProfile in eVault (attempt ${attempt}/${maxRetries}):`,
                    error
                );

                if (attempt === maxRetries) {
                    console.error("Max retries reached, giving up on PlatformProfile creation");
                    throw error;
                }

                // Wait before retrying (exponential backoff)
                const delay = Math.min(1000 * 2 ** (attempt - 1), 20000);
                console.log(`Waiting ${delay}ms before retry...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        throw new Error("Failed to create PlatformProfile after all retries");
    }

    /**
     * Get platform eVault mapping
     */
    async getPlatformEVaultMapping(): Promise<UserEVaultMapping | null> {
        const mappingRepository = AppDataSource.getRepository(UserEVaultMapping);
        return await mappingRepository.findOne({
            where: { localUserId: "cerberus-platform" }
        });
    }

    /**
     * Get platform eName (W3ID)
     */
    async getPlatformEName(): Promise<string | null> {
        const mapping = await this.getPlatformEVaultMapping();
        return mapping?.evaultW3id || null;
    }

    /**
     * Get platform eVault URI
     */
    async getPlatformEVaultUri(): Promise<string | null> {
        const mapping = await this.getPlatformEVaultMapping();
        return mapping?.evaultUri || null;
    }

    /**
     * Update platform profile in eVault
     */
    async updatePlatformProfile(updates: Partial<PlatformProfile>): Promise<void> {
        const mapping = await this.getPlatformEVaultMapping();
        if (!mapping) {
            throw new Error("Platform eVault mapping not found");
        }

        const client = await this.ensureClient(mapping.evaultW3id);
        
        // Get current profile data
        const currentData = mapping.userProfileData as PlatformProfile;
        const updatedData = {
            ...currentData,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Update in eVault
        await client.request<MetaEnvelopeResponse>(
            STORE_META_ENVELOPE,
            {
                input: {
                    ontology: "550e8400-e29b-41d4-a716-446655440000",
                    payload: updatedData,
                    acl: ["*"],
                },
            }
        );

        // Update local mapping
        mapping.userProfileData = updatedData;
        await AppDataSource.getRepository(UserEVaultMapping).save(mapping);
    }
} 