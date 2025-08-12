import {
    EventSubscriber,
    EntitySubscriberInterface,
    InsertEvent,
    UpdateEvent,
    RemoveEvent,
    ObjectLiteral,
} from "typeorm";
import { Web3Adapter } from "../../../../../infrastructure/web3-adapter/src/index";
import path from "path";
import dotenv from "dotenv";
import { AppDataSource } from "../../database/data-source";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

export const adapter = new Web3Adapter({
    schemasPath: path.resolve(__dirname, "../mappings/"),
    dbPath: path.resolve(process.env.EVOTING_MAPPING_DB_PATH as string),
    registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
    platform: process.env.PUBLIC_EVOTING_BASE_URL as string,
});

const JUNCTION_TABLE_MAP = {
    poll_votes: { entity: "Poll", idField: "poll_id" },
};

@EventSubscriber()
export class PostgresSubscriber implements EntitySubscriberInterface {
    private adapter: Web3Adapter;

    constructor() {
        this.adapter = adapter;
    }

    afterLoad(entity: any) {
    }

    beforeInsert(event: InsertEvent<any>) {
    }

    async enrichEntity(entity: any, tableName: string, tableTarget: any) {
        try {
            const enrichedEntity = { ...entity };

            if (entity.creator) {
                const creator = await AppDataSource.getRepository(
                    "User"
                ).findOne({ where: { id: entity.creator.id } });
                enrichedEntity.creator = creator;
            }

            if (entity.user) {
                const user = await AppDataSource.getRepository(
                    "User"
                ).findOne({ where: { id: entity.user.id } });
                enrichedEntity.user = user;
            }

            return this.entityToPlain(enrichedEntity);
        } catch (error) {
            console.error("Error loading relations:", error);
            return this.entityToPlain(entity);
        }
    }

    async afterInsert(event: InsertEvent<any>) {
        let entity = event.entity;
        if (entity) {
            entity = (await this.enrichEntity(
                entity,
                event.metadata.tableName,
                event.metadata.target
            )) as ObjectLiteral;
        }
        this.handleChange(
            entity ?? event.entity,
            event.metadata.tableName.endsWith("s")
                ? event.metadata.tableName
                : event.metadata.tableName + "s"
        );
    }

    beforeUpdate(event: UpdateEvent<any>) {
    }

    async afterUpdate(event: UpdateEvent<any>) {
        let entity = event.entity;
        if (entity) {
            entity = (await this.enrichEntity(
                entity,
                event.metadata.tableName,
                event.metadata.target
            )) as ObjectLiteral;
        }
        this.handleChange(
            entity ?? event.entity,
            event.metadata.tableName.endsWith("s")
                ? event.metadata.tableName
                : event.metadata.tableName + "s"
        );
    }

    beforeRemove(event: RemoveEvent<any>) {
    }

    async afterRemove(event: RemoveEvent<any>) {
        this.handleChange(
            event.entityId,
            event.metadata.tableName.endsWith("s")
                ? event.metadata.tableName
                : event.metadata.tableName + "s"
        );
    }

    private async handleChange(entity: any, tableName: string): Promise<void> {
        try {
            if (tableName === "user_evault_mappings") {
                return;
            }

            const junctionInfo = JUNCTION_TABLE_MAP[tableName as keyof typeof JUNCTION_TABLE_MAP];
            if (junctionInfo) {
                await this.handleJunctionTableChange(entity, junctionInfo);
                return;
            }

            const entityType = this.getEntityTypeFromTableName(tableName);
            if (!entityType) {
                console.log(`No entity type found for table: ${tableName}`);
                return;
            }

            const relations = this.getRelationsForEntity(entityType);
            const enrichedEntity = await this.enrichEntityWithRelations(entity, entityType, relations);

            await this.adapter.handleChange({
                data: enrichedEntity,
                tableName: entityType,
            });
        } catch (error) {
            console.error(`Error handling change for table ${tableName}:`, error);
        }
    }

    private async handleJunctionTableChange(
        entity: any,
        junctionInfo: { entity: string; idField: string }
    ): Promise<void> {
        try {
            const parentEntityId = entity[junctionInfo.idField];
            if (!parentEntityId) {
                console.log(`No parent entity ID found in junction table`);
                return;
            }

            const parentEntity = await AppDataSource.getRepository(junctionInfo.entity).findOne({
                where: { id: parentEntityId },
                relations: this.getRelationsForEntity(junctionInfo.entity),
            });

            if (parentEntity) {
                await this.adapter.handleChange({
                    data: parentEntity,
                    tableName: junctionInfo.entity,
                });
            }
        } catch (error) {
            console.error("Error handling junction table change:", error);
        }
    }

    private getEntityTypeFromTableName(tableName: string): string | null {
        const entityMap: { [key: string]: string } = {
            users: "User",
            polls: "Poll",
            votes: "Vote",
        };
        return entityMap[tableName] || null;
    }

    private getRelationsForEntity(entityName: string): string[] {
        const relationMap: { [key: string]: string[] } = {
            User: ["polls", "votes"],
            Poll: ["creator", "votes"],
            Vote: ["poll", "user"],
        };
        return relationMap[entityName] || [];
    }

    private async enrichEntityWithRelations(entity: any, entityType: string, relations: string[]): Promise<any> {
        try {
            const enrichedEntity = { ...entity };
            const repository = AppDataSource.getRepository(entityType);

            for (const relation of relations) {
                if (entity[relation]) {
                    const relatedEntity = await repository.findOne({
                        where: { id: entity[relation].id || entity[relation] },
                        relations: this.getRelationsForEntity(relation),
                    });
                    enrichedEntity[relation] = relatedEntity;
                }
            }

            return this.entityToPlain(enrichedEntity);
        } catch (error) {
            console.error("Error enriching entity with relations:", error);
            return this.entityToPlain(entity);
        }
    }

    private entityToPlain(entity: any): any {
        if (!entity) return entity;

        const plain: any = {};
        for (const [key, value] of Object.entries(entity)) {
            if (value !== undefined && value !== null) {
                if (typeof value === "object" && value.constructor === Object) {
                    plain[key] = this.entityToPlain(value);
                } else if (Array.isArray(value)) {
                    plain[key] = value.map((item) => this.entityToPlain(item));
                } else {
                    plain[key] = value;
                }
            }
        }
        return plain;
    }
} 