import * as fs from "fs/promises";
import path from "path";
import { IMapping } from "./mapper/mapper.types";
import { fromGlobal, toGlobal } from "./mapper/mapper";
import { MappingDatabase } from "./db";
import { EVaultClient } from "./evault/evault";
import { table } from "console";

export class Web3Adapter {
    mapping: Record<string, IMapping> = {};
    mappingDb: MappingDatabase;
    evaultClient: EVaultClient;
    lockedIds: string[] = [];

    constructor(
        private readonly config: {
            schemasPath: string;
            dbPath: string;
            registryUrl: string;
        }
    ) {
        this.readPaths();
        this.mappingDb = new MappingDatabase(config.dbPath);
        this.evaultClient = new EVaultClient(config.registryUrl);
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
        }, 5_000);
    }

    async handleChange(props: {
        data: Record<string, unknown>;
        tableName: string;
        participants?: string[];
    }) {
        const { data, tableName, participants } = props;

        const existingGlobalId = this.mappingDb.getGlobalId({
            localId: data.id as string,
            tableName,
        });

        // If we already have a mapping, use that global ID
        if (existingGlobalId) {
            const global = toGlobal({
                data,
                mapping: this.mapping[tableName],
                mappingStore: this.mappingDb,
            });

            // Update the existing global entity
            // await this.evaultClient.updateMetaEnvelopeById(existingGlobalId, {
            //     id: existingGlobalId,
            //     w3id: global.ownerEvault as string,
            //     data: global.data,
            //     schemaId: this.mapping[tableName].schemaId,
            // });

            return {
                id: existingGlobalId,
                w3id: global.ownerEvault as string,
                data: global.data,
                schemaId: this.mapping[tableName].schemaId,
            };
        }

        // For new entities, create a new global ID
        const global = toGlobal({
            data,
            mapping: this.mapping[tableName],
            mappingStore: this.mappingDb,
        });
        console.log(data, global, existingGlobalId);

        const globalId = await this.evaultClient.storeMetaEnvelope({
            id: null,
            w3id: global.ownerEvault as string,
            data: global.data,
            schemaId: this.mapping[tableName].schemaId,
        });

        // Store the mapping
        this.mappingDb.storeMapping({
            localId: data.id as string,
            globalId,
            tableName,
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

    fromGlobal(props: { data: Record<string, unknown>; mapping: IMapping }) {
        const { data, mapping } = props;

        const local = fromGlobal({
            data,
            mapping,
            mappingStore: this.mappingDb,
        });

        return local;
    }
}
