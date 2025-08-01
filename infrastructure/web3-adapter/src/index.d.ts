import { MappingDatabase } from "./db";
import { EVaultClient } from "./evault/evault";
import type { IMapping } from "./mapper/mapper.types";
/**
 * Standalone function to spin up an eVault
 * @param registryUrl - URL of the registry service
 * @param provisionerUrl - URL of the provisioner service
 * @param verificationCode - Optional verification code, defaults to demo code
 * @returns Promise with eVault details (w3id, uri)
 */
export declare function spinUpEVault(registryUrl: string, provisionerUrl: string, verificationCode?: string): Promise<{
    w3id: string;
    uri: string;
}>;
/**
 * Standalone function to create a group eVault with GroupManifest
 * @param registryUrl - URL of the registry service
 * @param provisionerUrl - URL of the provisioner service
 * @param groupData - Group data for the manifest
 * @param verificationCode - Optional verification code, defaults to demo code
 * @returns Promise with eVault details (w3id, uri, manifestId)
 */
export declare function createGroupEVault(registryUrl: string, provisionerUrl: string, groupData: {
    name: string;
    avatar?: string;
    description?: string;
    members: string[];
    admins: string[];
    owner: string;
    charter?: string;
}, verificationCode?: string): Promise<{
    w3id: string;
    uri: string;
    manifestId: string;
}>;
export declare class Web3Adapter {
    private readonly config;
    mapping: Record<string, IMapping>;
    mappingDb: MappingDatabase;
    evaultClient: EVaultClient;
    lockedIds: string[];
    platform: string;
    constructor(config: {
        schemasPath: string;
        dbPath: string;
        registryUrl: string;
        platform: string;
        provisionerUrl?: string;
    });
    readPaths(): Promise<void>;
    addToLockedIds(id: string): void;
    handleChange(props: {
        data: Record<string, unknown>;
        tableName: string;
        participants?: string[];
    }): Promise<{
        id: string;
        w3id: string;
        data: Record<string, unknown>;
        schemaId: string;
    } | undefined>;
    fromGlobal(props: {
        data: Record<string, unknown>;
        mapping: IMapping;
    }): Promise<Omit<import("./mapper/mapper.types").IMapperResponse, "ownerEvault">>;
    /**
     * Spins up an eVault by getting entropy from registry and provisioning it
     * @param verificationCode - Optional verification code, defaults to demo code
     * @param provisionerUrl - Optional provisioner URL, defaults to config
     * @returns Promise with eVault details (w3id, uri)
     */
    spinUpEVault(verificationCode?: string, provisionerUrl?: string): Promise<{
        w3id: string;
        uri: string;
    }>;
    /**
     * Creates a group eVault with GroupManifest
     * @param groupData - Group data for the manifest
     * @param verificationCode - Optional verification code, defaults to demo code
     * @param provisionerUrl - Optional provisioner URL, defaults to config
     * @returns Promise with eVault details (w3id, uri, manifestId)
     */
    createGroupEVault(groupData: {
        name: string;
        avatar?: string;
        description?: string;
        members: string[];
        admins: string[];
        owner: string;
        charter?: string;
    }, verificationCode?: string, provisionerUrl?: string): Promise<{
        w3id: string;
        uri: string;
        manifestId: string;
    }>;
}
//# sourceMappingURL=index.d.ts.map