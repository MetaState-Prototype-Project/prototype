import * as fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { MappingDatabase } from "./db";
import { EVaultClient } from "./evault/evault";
import { fromGlobal, toGlobal } from "./mapper/mapper";
import type { IMapping } from "./mapper/mapper.types";

/**
 * Standalone function to spin up an eVault
 * @param registryUrl - URL of the registry service
 * @param provisionerUrl - URL of the provisioner service
 * @param verificationCode - Optional verification code, defaults to demo code
 * @returns Promise with eVault details (w3id, uri)
 */
export async function spinUpEVault(
    registryUrl: string,
    provisionerUrl: string,
    verificationCode?: string,
): Promise<{ w3id: string; uri: string }> {
    const DEMO_CODE_W3DS = "d66b7138-538a-465f-a6ce-f6985854c3f4";
    const finalVerificationCode = verificationCode || DEMO_CODE_W3DS;

    try {
        const entropyResponse = await axios.get(
            new URL("/entropy", registryUrl).toString(),
        );
        const registryEntropy = entropyResponse.data.token;

        const namespace = uuidv4();

        const provisionResponse = await axios.post(
            new URL("/provision", provisionerUrl).toString(),
            {
                registryEntropy,
                namespace,
                verificationId: finalVerificationCode,
            },
        );

        if (!provisionResponse.data.success) {
            throw new Error(
                `Failed to provision eVault: ${provisionResponse.data.message || "Unknown error"}`,
            );
        }

        return {
            w3id: provisionResponse.data.w3id,
            uri: provisionResponse.data.uri,
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(
                `Failed to spin up eVault: ${error.response?.data?.message || error.message}`,
            );
        }
        throw new Error(
            `Failed to spin up eVault: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
    }
}

/**
 * Interface for GroupManifest data
 */
interface GroupManifest {
    eName: string;
    name: string;
    avatar?: string;
    description?: string;
    members: string[];
    charter?: string;
    admins: string[];
    owner: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Standalone function to create a group eVault with GroupManifest
 * @param registryUrl - URL of the registry service
 * @param provisionerUrl - URL of the provisioner service
 * @param groupData - Group data for the manifest
 * @param verificationCode - Optional verification code, defaults to demo code
 * @returns Promise with eVault details (w3id, uri, manifestId)
 */
export async function createGroupEVault(
    registryUrl: string,
    provisionerUrl: string,
    groupData: {
        name: string;
        avatar?: string;
        description?: string;
        members: string[];
        admins: string[];
        owner: string;
        charter?: string;
    },
    verificationCode?: string,
): Promise<{ w3id: string; uri: string; manifestId: string }> {
    const DEMO_CODE_W3DS = "d66b7138-538a-465f-a6ce-f6985854c3f4";
    const finalVerificationCode = verificationCode || DEMO_CODE_W3DS;

    try {
        // Step 1: Spin up the eVault
        const evault = await spinUpEVault(
            registryUrl,
            provisionerUrl,
            finalVerificationCode,
        );

        // Step 2: Create GroupManifest with exponential backoff
        const manifestId = await createGroupManifestWithRetry(
            registryUrl,
            evault.w3id,
            groupData,
        );

        return {
            w3id: evault.w3id,
            uri: evault.uri,
            manifestId,
        };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(
                `Failed to create group eVault: ${error.response?.data?.message || error.message}`,
            );
        }
        throw new Error(
            `Failed to create group eVault: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
    }
}

/**
 * Create GroupManifest in eVault with exponential backoff retry mechanism
 */
async function createGroupManifestWithRetry(
    registryUrl: string,
    w3id: string,
    groupData: {
        name: string;
        avatar?: string;
        description?: string;
        members: string[];
        admins: string[];
        owner: string;
        charter?: string;
    },
    maxRetries = 10,
): Promise<string> {
    const now = new Date().toISOString();

    const groupManifest: GroupManifest = {
        eName: w3id,
        name: groupData.name,
        avatar: groupData.avatar,
        description: groupData.description,
        members: groupData.members,
        charter: groupData.charter,
        admins: groupData.admins,
        owner: groupData.owner,
        createdAt: now,
        updatedAt: now,
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(
                `Attempting to create GroupManifest in eVault (attempt ${attempt}/${maxRetries})`,
            );

            const response = await axios.get(
                new URL(`resolve?w3id=${w3id}`, registryUrl).toString(),
            );
            const endpoint = new URL("/graphql", response.data.uri).toString();

            const { GraphQLClient } = await import("graphql-request");
            const client = new GraphQLClient(endpoint);

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
                        parsed: unknown;
                    };
                };
            }

            const result = await client.request<MetaEnvelopeResponse>(
                STORE_META_ENVELOPE,
                {
                    input: {
                        ontology: "550e8400-e29b-41d4-a716-446655440001", // GroupManifest schema ID
                        payload: groupManifest,
                        acl: ["*"],
                    },
                },
            );

            const manifestId = result.storeMetaEnvelope.metaEnvelope.id;
            console.log(
                "GroupManifest created successfully in eVault:",
                manifestId,
            );
            return manifestId;
        } catch (error) {
            console.error(
                `Failed to create GroupManifest in eVault (attempt ${attempt}/${maxRetries}):`,
                error,
            );

            if (attempt === maxRetries) {
                console.error(
                    "Max retries reached, giving up on GroupManifest creation",
                );
                throw error;
            }

            // Wait before retrying (exponential backoff)
            const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw new Error("Failed to create GroupManifest after all retries");
}

export class Web3Adapter {
    mapping: Record<string, IMapping> = {};
    mappingDb: MappingDatabase;
    evaultClient: EVaultClient;
    lockedIds: string[] = [];
    platform: string;

    constructor(
        private readonly config: {
            schemasPath: string;
            dbPath: string;
            registryUrl: string;
            platform: string;
            provisionerUrl?: string;
        },
    ) {
        this.readPaths();
        this.mappingDb = new MappingDatabase(config.dbPath);
        this.evaultClient = new EVaultClient(
            config.registryUrl,
            config.platform,
        );
        this.platform = config.platform;
    }

    async readPaths() {
        const allRawFiles = await fs.readdir(this.config.schemasPath);
        const mappingFiles = allRawFiles.filter((p: string) =>
            p.endsWith(".json"),
        );

        for (const mappingFile of mappingFiles) {
            const mappingFileContent = await fs.readFile(
                path.join(this.config.schemasPath, mappingFile),
            );
            const mappingParsed = JSON.parse(
                mappingFileContent.toString(),
            ) as IMapping;
            this.mapping[mappingParsed.tableName] = mappingParsed;
        }
    }

    addToLockedIds(id: string) {
        this.lockedIds.push(id);
        console.log("Added", this.lockedIds);
        setTimeout(() => {
            this.lockedIds = this.lockedIds.filter((f) => f !== id);
        }, 15_000);
    }

    async handleChange(props: {
        data: Record<string, unknown>;
        tableName: string;
        participants?: string[];
    }) {
        const { data, tableName, participants } = props;

        const existingGlobalId = await this.mappingDb.getGlobalId(
            data.id as string,
        );

        if (!this.mapping[tableName]) return;
        console.log("We get here?");
        // If we already have a mapping, use that global ID
        if (existingGlobalId) {
            if (this.lockedIds.includes(existingGlobalId)) return;
            const global = await toGlobal({
                data,
                mapping: this.mapping[tableName],
                mappingStore: this.mappingDb,
            });

            this.evaultClient
                .updateMetaEnvelopeById(existingGlobalId, {
                    id: existingGlobalId,
                    w3id: global.ownerEvault as string,
                    data: global.data,
                    schemaId: this.mapping[tableName].schemaId,
                })
                .catch(() => console.error("failed to sync update"));

            return {
                id: existingGlobalId,
                w3id: global.ownerEvault as string,
                data: global.data,
                schemaId: this.mapping[tableName].schemaId,
            };
        }

        const global = await toGlobal({
            data,
            mapping: this.mapping[tableName],
            mappingStore: this.mappingDb,
        });

        let globalId: string;
        if (global.ownerEvault) {
            globalId = await this.evaultClient.storeMetaEnvelope({
                id: null,
                w3id: global.ownerEvault as string,
                data: global.data,
                schemaId: this.mapping[tableName].schemaId,
            });
            console.log("created new meta-env", globalId);
        } else {
            return;
        }

        // Store the mapping
        await this.mappingDb.storeMapping({
            localId: data.id as string,
            globalId,
        });

        // Handle references for other participants
        const otherEvaults = (participants ?? []).filter(
            (i: string) => i !== global.ownerEvault,
        );
        for (const evault of otherEvaults) {
            await this.evaultClient.storeReference(
                `${global.ownerEvault}/${globalId}`,
                evault,
            );
        }

        return {
            id: globalId,
            w3id: global.ownerEvault as string,
            data: global.data,
            schemaId: this.mapping[tableName].schemaId,
        };
    }

    async fromGlobal(props: {
        data: Record<string, unknown>;
        mapping: IMapping;
    }) {
        const { data, mapping } = props;

        const local = await fromGlobal({
            data,
            mapping,
            mappingStore: this.mappingDb,
        });

        return local;
    }

    /**
     * Spins up an eVault by getting entropy from registry and provisioning it
     * @param verificationCode - Optional verification code, defaults to demo code
     * @param provisionerUrl - Optional provisioner URL, defaults to config
     * @returns Promise with eVault details (w3id, uri)
     */
    async spinUpEVault(
        verificationCode?: string,
        provisionerUrl?: string,
    ): Promise<{ w3id: string; uri: string }> {
        const finalProvisionerUrl =
            provisionerUrl || this.config.provisionerUrl;

        if (!finalProvisionerUrl) {
            throw new Error(
                "Provisioner URL is required. Please provide it in config or as parameter.",
            );
        }

        return spinUpEVault(
            this.config.registryUrl,
            finalProvisionerUrl,
            verificationCode,
        );
    }

    /**
     * Creates a group eVault with GroupManifest
     * @param groupData - Group data for the manifest
     * @param verificationCode - Optional verification code, defaults to demo code
     * @param provisionerUrl - Optional provisioner URL, defaults to config
     * @returns Promise with eVault details (w3id, uri, manifestId)
     */
    async createGroupEVault(
        groupData: {
            name: string;
            avatar?: string;
            description?: string;
            members: string[];
            admins: string[];
            owner: string;
            charter?: string;
        },
        verificationCode?: string,
        provisionerUrl?: string,
    ): Promise<{ w3id: string; uri: string; manifestId: string }> {
        const finalProvisionerUrl =
            provisionerUrl || this.config.provisionerUrl;

        if (!finalProvisionerUrl) {
            throw new Error(
                "Provisioner URL is required. Please provide it in config or as parameter.",
            );
        }

        return createGroupEVault(
            this.config.registryUrl,
            finalProvisionerUrl,
            groupData,
            verificationCode,
        );
    }
}
