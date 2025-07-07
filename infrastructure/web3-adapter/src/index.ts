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
            data.id as string
        );

        console.log(this.mapping, tableName, this.mapping[tableName]);

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
