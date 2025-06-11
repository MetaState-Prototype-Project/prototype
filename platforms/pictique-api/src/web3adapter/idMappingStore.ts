import { AppDataSource } from "../database/data-source";
import { Web3IdMapping } from "../database/entities/Web3IdMapping";
import { IDMappingStore } from "./types";

export class TypeORMIdMappingStore implements IDMappingStore {
    private readonly repository = AppDataSource.getRepository(Web3IdMapping);

    async getMetaEnvelopeId(localId: string, entityType: string): Promise<string | null> {
        const mapping = await this.repository.findOne({
            where: { localId, entityType }
        });
        return mapping?.metaEnvelopeId || null;
    }

    async getLocalId(metaEnvelopeId: string, entityType: string): Promise<string | null> {
        const mapping = await this.repository.findOne({
            where: { metaEnvelopeId, entityType }
        });
        return mapping?.localId || null;
    }

    async storeMapping(localId: string, metaEnvelopeId: string, entityType: string): Promise<void> {
        // Check if mapping already exists
        const existingMapping = await this.repository.findOne({
            where: [
                { localId, entityType },
                { metaEnvelopeId, entityType }
            ]
        });

        console.log("existingMapping", existingMapping);
        if (existingMapping) {
            // Update existing mapping
            existingMapping.localId = localId;
            existingMapping.metaEnvelopeId = metaEnvelopeId;
            await this.repository.save(existingMapping);
        } else {
            // Create new mapping
            const mapping = new Web3IdMapping();
            mapping.localId = localId;
            mapping.metaEnvelopeId = metaEnvelopeId;
            mapping.entityType = entityType;
            console.log("mapping", mapping);
            await this.repository.save(mapping);
        }
    }

    async deleteMapping(localId: string, entityType: string): Promise<void> {
        await this.repository.delete({ localId, entityType });
    }

    async deleteMappingByMetaEnvelopeId(metaEnvelopeId: string, entityType: string): Promise<void> {
        await this.repository.delete({ metaEnvelopeId, entityType });
    }
} 