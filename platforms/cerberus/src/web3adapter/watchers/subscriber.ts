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
    dbPath: path.resolve(process.env.CERBERUS_MAPPING_DB_PATH as string),
    registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
    platform: process.env.PUBLIC_CERBERUS_BASE_URL as string,
});

// Map of junction tables to their parent entities
const JUNCTION_TABLE_MAP = {
    user_followers: { entity: "User", idField: "user_id" },
    user_following: { entity: "User", idField: "user_id" },
    group_participants: { entity: "Group", idField: "group_id" },
};

@EventSubscriber()
export class PostgresSubscriber implements EntitySubscriberInterface {
    private adapter: Web3Adapter;

    constructor() {
        this.adapter = adapter;
    }

    /**
     * Called after entity is loaded.
     */
    afterLoad(entity: any) {
        // Handle any post-load processing if needed
    }

    /**
     * Called before entity insertion.
     */
    beforeInsert(event: InsertEvent<any>) {
        // Handle any pre-insert processing if needed
    }

    async enrichEntity(entity: any, tableName: string, tableTarget: any) {
        try {
            const enrichedEntity = { ...entity };

            if (entity.author) {
                const author = await AppDataSource.getRepository(
                    "User"
                ).findOne({ where: { id: entity.author.id } });
                enrichedEntity.author = author;
            }

            // Special handling for messages to ensure group and participants are loaded
            if (tableName === "messages" && entity.group) {
                const groupRepository = AppDataSource.getRepository("Group");
                const enrichedGroup = await groupRepository.findOne({
                    where: { id: entity.group.id },
                    relations: ["participants", "messages"]
                });
                if (enrichedGroup) {
                    enrichedEntity.group = enrichedGroup;
                }
            }

            return this.entityToPlain(enrichedEntity);
        } catch (error) {
            console.error("Error loading relations:", error);
            return this.entityToPlain(entity);
        }
    }

    /**
     * Called after entity insertion.
     */
    async afterInsert(event: InsertEvent<any>) {
        console.log("------------------- AFTER INSERT--------------")
        let entity = event.entity;
        if (entity) {
            entity = (await this.enrichEntity(
                entity,
                event.metadata.tableName,
                event.metadata.target
            )) as ObjectLiteral;
        }
        this.handleChange(
            // @ts-ignore
            entity ?? event.entityId,
            event.metadata.tableName.endsWith("s")
                ? event.metadata.tableName
                : event.metadata.tableName + "s"
        );
    }

    /**
     * Called before entity update.
     */
    beforeUpdate(event: UpdateEvent<any>) {
        // Handle any pre-update processing if needed
    }

    /**
     * Called after entity update.
     */
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
            // @ts-ignore
            entity ?? event.entityId,
            event.metadata.tableName.endsWith("s")
                ? event.metadata.tableName
                : event.metadata.tableName + "s"
        );
    }

    /**
     * Called before entity removal.
     */
    beforeRemove(event: RemoveEvent<any>) {
        // Handle any pre-remove processing if needed
    }

    /**
     * Called after entity removal.
     */
    async afterRemove(event: RemoveEvent<any>) {
        this.handleChange(
            // @ts-ignore
            event.entityId,
            event.metadata.tableName.endsWith("s")
                ? event.metadata.tableName
                : event.metadata.tableName + "s"
        );
    }

    /**
     * Handle entity changes and send to web3adapter
     */
    private async handleChange(entity: any, tableName: string): Promise<void> {
        console.log("=======================================", entity.id)
        // Check if this is a junction table
        if (tableName === "group_participants") return;
        
        // @ts-ignore
        const junctionInfo = JUNCTION_TABLE_MAP[tableName];
        if (junctionInfo) {
            console.log("Processing junction table change:", tableName);
            await this.handleJunctionTableChange(entity, junctionInfo);
            return;
        }
        
        // Handle regular entity changes
        const data = this.entityToPlain(entity);
        if (!data.id) return;

        try {
            setTimeout(async () => {
                let globalId = await this.adapter.mappingDb.getGlobalId(
                    entity.id
                );
                globalId = globalId ?? "";

                if (this.adapter.lockedIds.includes(globalId)) {
                    console.log("Entity already locked, skipping:", globalId, entity.id);
                    return;
                }

                // Check if this entity was recently created by a webhook
                if (this.adapter.lockedIds.includes(entity.id)) {
                    console.log("Local entity locked (webhook created), skipping:", entity.id);
                    return;
                }

                console.log(
                    "sending packet for global Id",
                    globalId,
                    entity.id,
                    "table:",
                    tableName
                );
                const envelope = await this.adapter.handleChange({
                    data,
                    tableName: tableName.toLowerCase(),
                });
                console.log(envelope)
            }, 3_000);
        } catch (error) {
            console.error(`Error processing change for ${tableName}:`, error);
        }
    }

    /**
     * Handle changes in junction tables by converting them to parent entity changes
     */
    private async handleJunctionTableChange(
        entity: any,
        junctionInfo: { entity: string; idField: string }
    ): Promise<void> {
        try {
            const parentId = entity[junctionInfo.idField];
            if (!parentId) {
                console.error("No parent ID found in junction table change");
                return;
            }

            const repository = AppDataSource.getRepository(junctionInfo.entity);
            const parentEntity = await repository.findOne({
                where: { id: parentId },
                relations: this.getRelationsForEntity(junctionInfo.entity),
            });

            if (!parentEntity) {
                console.error(`Parent entity not found: ${parentId}`);
                return;
            }

            let globalId = await this.adapter.mappingDb.getGlobalId(entity.id);
            globalId = globalId ?? "";

            try {
                setTimeout(async () => {
                    let globalId = await this.adapter.mappingDb.getGlobalId(
                        entity.id
                    );
                    globalId = globalId ?? "";

                    if (this.adapter.lockedIds.includes(globalId))
                        return console.log("locked skipping ", globalId);

                    console.log(
                        "sending packet for global Id",
                        globalId,
                        entity.id
                    );

                    const tableName = `${junctionInfo.entity.toLowerCase()}s`;
                    await this.adapter.handleChange({
                        data: this.entityToPlain(parentEntity),
                        tableName,
                    });
                }, 3_000);
            } catch (error) {
                console.error(error);
            }
        } catch (error) {
            console.error("Error handling junction table change:", error);
        }
    }

    /**
     * Get the relations that should be loaded for each entity type
     */
    private getRelationsForEntity(entityName: string): string[] {
        switch (entityName) {
            case "User":
                return ["followers", "following"];
            case "Group":
                return ["participants", "messages"];
            case "Message":
                return ["sender", "group"];
            default:
                return [];
        }
    }

    /**
     * Convert TypeORM entity to plain object
     */
    private entityToPlain(entity: any): any {
        if (!entity) return {};

        // If it's already a plain object, return it
        if (typeof entity !== "object" || entity === null) {
            return entity;
        }

        // Handle Date objects
        if (entity instanceof Date) {
            return entity.toISOString();
        }

        // Handle arrays
        if (Array.isArray(entity)) {
            return entity.map((item) => this.entityToPlain(item));
        }

        // Convert entity to plain object
        const plain: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(entity)) {
            // Skip private properties and methods
            if (key.startsWith("_")) continue;

            // Handle nested objects and arrays
            if (value && typeof value === "object") {
                if (Array.isArray(value)) {
                    plain[key] = value.map((item) => this.entityToPlain(item));
                } else if (value instanceof Date) {
                    plain[key] = value.toISOString();
                } else {
                    plain[key] = this.entityToPlain(value);
                }
            } else {
                plain[key] = value;
            }
        }

        return plain;
    }
} 