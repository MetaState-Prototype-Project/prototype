import * as fs from "fs/promises";
import path from "path";
import { IMapping } from "./mapper/mapper.types";
import { toGlobal } from "./mapper/mapper";
import { MappingDatabase } from "./db";
import { EVaultClient } from "./evault/evault";

export class Web3Adapter {
    mapping: Record<string, IMapping> = {};
    mappingDb: MappingDatabase;
    evaultClient: EVaultClient;

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

    async handleChange(props: {
        data: Record<string, unknown>;
        tableName: string;
        participants?: string[];
    }) {
        const { data, tableName, participants } = props;
        const mappingExists = this.mappingDb.getGlobalId({
            localId: data.id as string,
            tableName,
        });
        const global = toGlobal({
            data,
            mapping: this.mapping[tableName],
            mappingStore: this.mappingDb,
        });
        console.log(global);
        let globalId: string;
        const otherEvaults = (participants ?? []).filter(
            (i: string) => i !== global.ownerEvault
        );
        if (mappingExists) {
            globalId = mappingExists;
            await this.evaultClient.updateMetaEnvelopeById(globalId, {
                id: globalId,
                w3id: global.ownerEvault as string,
                data: global.data,
                schemaId: this.mapping[tableName].schemaId,
            });
        } else {
            globalId = await this.evaultClient.storeMetaEnvelope({
                id: null,
                w3id: global.ownerEvault as string,
                data: global.data,
                schemaId: this.mapping[tableName].schemaId,
            });
            this.mappingDb.storeMapping({
                localId: data.id as string,
                globalId,
                tableName,
            });
        }

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
}
