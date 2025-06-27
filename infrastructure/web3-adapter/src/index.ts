import * as fs from "fs/promises";
import path from "path";
import { IMapping } from "./mapper/mapper.types";
import { fromGlobal, toGlobal } from "./mapper/mapper";
import { MappingDatabase } from "./db";
import { EVaultClient } from "./evault/evault";
import { v4 as uuidv4 } from "uuid";

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
        }
    ) {
        this.readPaths();
        this.mappingDb = new MappingDatabase(config.dbPath);
        this.evaultClient = new EVaultClient(
            config.registryUrl,
            config.platform
        );
        this.platform = config.platform;
    }

    async readPaths() {
        const allRawFiles = await fs.readdir(this.config.schemasPath);
        const mappingFiles = allRawFiles.filter((p: string) =>
            p.endsWith(".json")
        );

        for (const mappingFile of mappingFiles) {
            const mappingFileContent = await fs.readFile(
                path.join(this.config.schemasPath, mappingFile)
            );
            const mappingParsed = JSON.parse(
                mappingFileContent.toString()
            ) as IMapping;
            this.mapping[mappingParsed.tableName] = mappingParsed;
        }
    }

    addToLockedIds(id: string) {
        if (this.lockedIds.includes(id)) {
            return false; // Already locked
        }
        this.lockedIds.push(id);
        console.log("Added", id, "to lockedIds:", this.lockedIds);
        setTimeout(() => {
            this.lockedIds = this.lockedIds.filter((f) => f !== id);
            console.log("Removed", id, "from lockedIds:", this.lockedIds);
        }, 15_000);
        return true; // Successfully locked
    }

    /**
     * Lock both local and global IDs to prevent duplicates
     */
    private lockBothIds(localId: string, globalId: string | null): boolean {
        // Try to lock local ID first
        if (!this.addToLockedIds(localId)) {
            console.log(`Local ID ${localId} already locked, skipping operation`);
            return false;
        }

        // Also lock global ID if it exists
        if (globalId && globalId !== localId) {
            this.addToLockedIds(globalId);
            console.log(`Locked both IDs: local=${localId}, global=${globalId}`);
        } else {
            console.log(`Locked local ID: ${localId}`);
        }

        return true;
    }

    async handleChange(props: {
        data: Record<string, unknown>;
        tableName: string;
        participants?: string[];
    }) {
        const { data, tableName, participants } = props;

        const existingGlobalId = await this.mappingDb.getGlobalId({
            localId: data.id as string,
            tableName,
        });
        console.log("handleChange - localId:", data.id, "globalId:", existingGlobalId, "tableName:", tableName);

        // If we already have a mapping, use that global ID
        if (existingGlobalId) {
            // Try to lock both IDs atomically
            if (!this.lockBothIds(data.id as string, existingGlobalId)) {
                console.log("Failed to lock IDs, skipping update for:", data.id);
                return null;
            }

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
                .catch((error) => {
                    console.error("Failed to sync update:", error);
                    // Remove locks on failure
                    this.lockedIds = this.lockedIds.filter(id => id !== data.id && id !== existingGlobalId);
                });

            return {
                id: existingGlobalId,
                w3id: global.ownerEvault as string,
                data: global.data,
                schemaId: this.mapping[tableName].schemaId,
            };
        }

        // For new entities, create a new global ID
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
        } else {
            globalId = uuidv4();
        }

        console.log("Created new global ID:", globalId, "for local ID:", data.id);

        // Store the mapping
        await this.mappingDb.storeMapping({
            localId: data.id as string,
            globalId,
            tableName,
        });

        // Lock both IDs after creation
        this.lockBothIds(data.id as string, globalId);

        // Handle references for other participants
        const otherEvaults = (participants ?? []).filter(
            (i: string) => i !== global.ownerEvault
        );
        for (const evault of otherEvaults) {
            await this.evaultClient.storeReference(
                `${global.ownerEvault}/${globalId}`,
                evault
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
}
