"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Web3Adapter = void 0;
exports.spinUpEVault = spinUpEVault;
exports.createGroupEVault = createGroupEVault;
const fs = __importStar(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const db_1 = require("./db");
const evault_1 = require("./evault/evault");
const logging_1 = require("./logging");
const mapper_1 = require("./mapper/mapper");
/**
 * Standalone function to spin up an eVault
 * @param registryUrl - URL of the registry service
 * @param provisionerUrl - URL of the provisioner service
 * @param verificationCode - Optional verification code, defaults to demo code
 * @returns Promise with eVault details (w3id, uri)
 */
async function spinUpEVault(registryUrl, provisionerUrl, verificationCode) {
    const DEMO_CODE_W3DS = "d66b7138-538a-465f-a6ce-f6985854c3f4";
    const finalVerificationCode = verificationCode || DEMO_CODE_W3DS;
    try {
        const entropyResponse = await axios_1.default.get(new URL("/entropy", registryUrl).toString());
        const registryEntropy = entropyResponse.data.token;
        const namespace = (0, uuid_1.v4)();
        const provisionResponse = await axios_1.default.post(new URL("/provision", provisionerUrl).toString(), {
            registryEntropy,
            namespace,
            verificationId: finalVerificationCode,
            publicKey: "0x0000000000000000000000000000000000000000"
        });
        if (!provisionResponse.data.success) {
            throw new Error(`Failed to provision eVault: ${provisionResponse.data.message || "Unknown error"}`);
        }
        return {
            w3id: provisionResponse.data.w3id,
            uri: provisionResponse.data.uri,
        };
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            throw new Error(`Failed to spin up eVault: ${error.response?.data?.message || error.message}`);
        }
        throw new Error(`Failed to spin up eVault: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
/**
 * Standalone function to create a group eVault with GroupManifest
 * @param registryUrl - URL of the registry service
 * @param provisionerUrl - URL of the provisioner service
 * @param groupData - Group data for the manifest
 * @param verificationCode - Optional verification code, defaults to demo code
 * @returns Promise with eVault details (w3id, uri, manifestId)
 */
async function createGroupEVault(registryUrl, provisionerUrl, groupData, verificationCode) {
    const DEMO_CODE_W3DS = "d66b7138-538a-465f-a6ce-f6985854c3f4";
    const finalVerificationCode = verificationCode || DEMO_CODE_W3DS;
    try {
        // Step 1: Spin up the eVault
        const evault = await spinUpEVault(registryUrl, provisionerUrl, finalVerificationCode);
        // Step 2: Create GroupManifest with exponential backoff
        const manifestId = await createGroupManifestWithRetry(registryUrl, evault.w3id, groupData);
        return {
            w3id: evault.w3id,
            uri: evault.uri,
            manifestId,
        };
    }
    catch (error) {
        if (axios_1.default.isAxiosError(error)) {
            throw new Error(`Failed to create group eVault: ${error.response?.data?.message || error.message}`);
        }
        throw new Error(`Failed to create group eVault: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
}
/**
 * Create GroupManifest in eVault with exponential backoff retry mechanism
 */
async function createGroupManifestWithRetry(registryUrl, w3id, groupData, maxRetries = 10) {
    const now = new Date().toISOString();
    const groupManifest = {
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
            console.log(`Attempting to create GroupManifest in eVault (attempt ${attempt}/${maxRetries})`);
            const response = await axios_1.default.get(new URL(`resolve?w3id=${w3id}`, registryUrl).toString());
            const endpoint = new URL("/graphql", response.data.uri).toString();
            const { GraphQLClient } = await Promise.resolve().then(() => __importStar(require("graphql-request")));
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
            const result = await client.request(STORE_META_ENVELOPE, {
                input: {
                    ontology: "550e8400-e29b-41d4-a716-446655440001", // GroupManifest schema ID
                    payload: groupManifest,
                    acl: ["*"],
                },
            });
            const manifestId = result.storeMetaEnvelope.metaEnvelope.id;
            console.log("GroupManifest created successfully in eVault:", manifestId);
            return manifestId;
        }
        catch (error) {
            console.error(`Failed to create GroupManifest in eVault (attempt ${attempt}/${maxRetries}):`, error);
            if (attempt === maxRetries) {
                console.error("Max retries reached, giving up on GroupManifest creation");
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
class Web3Adapter {
    constructor(config) {
        this.config = config;
        this.mapping = {};
        this.lockedIds = [];
        this.readPaths();
        this.mappingDb = new db_1.MappingDatabase(config.dbPath);
        this.evaultClient = new evault_1.EVaultClient(config.registryUrl, config.platform);
        this.platform = config.platform;
    }
    async readPaths() {
        const allRawFiles = await fs.readdir(this.config.schemasPath);
        const mappingFiles = allRawFiles.filter((p) => p.endsWith(".json"));
        for (const mappingFile of mappingFiles) {
            const mappingFileContent = await fs.readFile(node_path_1.default.join(this.config.schemasPath, mappingFile));
            const mappingParsed = JSON.parse(mappingFileContent.toString());
            this.mapping[mappingParsed.tableName] = mappingParsed;
        }
    }
    addToLockedIds(id) {
        this.lockedIds.push(id);
        console.log("Added", this.lockedIds);
        setTimeout(() => {
            this.lockedIds = this.lockedIds.filter((f) => f !== id);
        }, 15000);
    }
    async handleChange(props) {
        const { data, tableName, participants } = props;
        const existingGlobalId = await this.mappingDb.getGlobalId(data.id);
        if (!this.mapping[tableName])
            return;
        if (this.mapping[tableName].readOnly) {
            // early return on mappings which are readonly so as to not 
            // sync any update to the eVault which is not warranted
            return;
        }
        if (existingGlobalId) {
            if (this.lockedIds.includes(existingGlobalId))
                return;
            const global = await (0, mapper_1.toGlobal)({
                data,
                mapping: this.mapping[tableName],
                mappingStore: this.mappingDb,
            });
            this.evaultClient
                .updateMetaEnvelopeById(existingGlobalId, {
                id: existingGlobalId,
                w3id: global.ownerEvault,
                data: global.data,
                schemaId: this.mapping[tableName].schemaId,
            })
                .catch(() => console.error("failed to sync update"));
            logging_1.logger.info({
                tableName,
                id: existingGlobalId,
                platform: this.platform,
                w3id: global.ownerEvault,
            });
            return {
                id: existingGlobalId,
                w3id: global.ownerEvault,
                schemaId: this.mapping[tableName].tableName,
            };
        }
        const global = await (0, mapper_1.toGlobal)({
            data,
            mapping: this.mapping[tableName],
            mappingStore: this.mappingDb,
        });
        let globalId;
        if (global.ownerEvault) {
            globalId = await this.evaultClient.storeMetaEnvelope({
                id: null,
                w3id: global.ownerEvault,
                data: global.data,
                schemaId: this.mapping[tableName].schemaId,
            });
            console.log("created new meta-env", globalId);
        }
        else {
            return;
        }
        // Store the mapping
        await this.mappingDb.storeMapping({
            localId: data.id,
            globalId,
        });
        // Handle references for other participants
        const otherEvaults = (participants ?? []).filter((i) => i !== global.ownerEvault);
        for (const evault of otherEvaults) {
            await this.evaultClient.storeReference(`${global.ownerEvault}/${globalId}`, evault);
        }
        logging_1.logger.info({
            tableName,
            id: globalId,
            w3id: global.ownerEvault,
            platform: this.platform
        });
        return {
            id: globalId,
            w3id: global.ownerEvault,
            data: global.data,
            schemaId: this.mapping[tableName].schemaId,
        };
    }
    async fromGlobal(props) {
        const { data, mapping } = props;
        const local = await (0, mapper_1.fromGlobal)({
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
    async spinUpEVault(verificationCode, provisionerUrl) {
        const finalProvisionerUrl = provisionerUrl || this.config.provisionerUrl;
        if (!finalProvisionerUrl) {
            throw new Error("Provisioner URL is required. Please provide it in config or as parameter.");
        }
        return spinUpEVault(this.config.registryUrl, finalProvisionerUrl, verificationCode);
    }
    /**
     * Creates a group eVault with GroupManifest
     * @param groupData - Group data for the manifest
     * @param verificationCode - Optional verification code, defaults to demo code
     * @param provisionerUrl - Optional provisioner URL, defaults to config
     * @returns Promise with eVault details (w3id, uri, manifestId)
     */
    async createGroupEVault(groupData, verificationCode, provisionerUrl) {
        const finalProvisionerUrl = provisionerUrl || this.config.provisionerUrl;
        if (!finalProvisionerUrl) {
            throw new Error("Provisioner URL is required. Please provide it in config or as parameter.");
        }
        return createGroupEVault(this.config.registryUrl, finalProvisionerUrl, groupData, verificationCode);
    }
}
exports.Web3Adapter = Web3Adapter;
//# sourceMappingURL=index.js.map