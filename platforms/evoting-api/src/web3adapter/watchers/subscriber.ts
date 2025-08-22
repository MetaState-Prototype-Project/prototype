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
    platform: process.env.PUBLIC_GROUP_CHARTER_BASE_URL as string,
});

// Map of junction tables to their parent entities
const JUNCTION_TABLE_MAP = {
    user_followers: { entity: "User", idField: "user_id" },
    user_following: { entity: "User", idField: "user_id" },
    group_participants: { entity: "Group", idField: "group_id" },
};

@EventSubscriber()
export class PostgresSubscriber implements EntitySubscriberInterface {
    static {
        console.log("🔧 PostgresSubscriber class is being loaded");
    }
    private adapter: Web3Adapter;

    constructor() {
        console.log("🚀 PostgresSubscriber constructor called - subscriber is being instantiated");
        this.adapter = adapter;
    }

   

    /**
     * Called before entity insertion.
     */
    beforeInsert(event: InsertEvent<any>) {
        console.log("🔍 beforeInsert triggered:", {
            tableName: event.metadata.tableName,
            target: typeof event.metadata.target === 'function' ? event.metadata.target.name : event.metadata.target,
            hasEntity: !!event.entity
        });
    }

    async enrichEntity(entity: any, tableName: string, tableTarget: any) {
        try {
            const enrichedEntity = { ...entity };

            // Handle author enrichment (for backward compatibility)
            if (entity.author) {
                const author = await AppDataSource.getRepository(
                    "User"
                ).findOne({ where: { id: entity.author.id } });
                enrichedEntity.author = author;
            }

            // Special handling for Message entities to ensure group and admin data is loaded
            if (tableName === "messages" && entity.group) {
                // Load the full group with admins and members
                const groupRepository = AppDataSource.getRepository("Group");
                const fullGroup = await groupRepository.findOne({
                    where: { id: entity.group.id },
                    relations: ["admins", "members", "participants"]
                });
                
                if (fullGroup) {
                    enrichedEntity.group = fullGroup;
                }
            }

            return this.entityToPlain(enrichedEntity);
        } catch (error) {
            console.error("Error loading relations:", error);
            return this.entityToPlain(entity);
        }
    }

    /**
     * Special enrichment method for Message entities to ensure group and admin data is loaded
     */
    private async enrichMessageEntity(messageEntity: any): Promise<any> {
        try {
            const enrichedMessage = { ...messageEntity };
            
            // If the message has a group, load the full group with admins and members
            if (enrichedMessage.group && enrichedMessage.group.id) {
                const groupRepository = AppDataSource.getRepository("Group");
                const fullGroup = await groupRepository.findOne({
                    where: { id: enrichedMessage.group.id },
                    relations: ["admins", "members", "participants"]
                });
                
                if (fullGroup) {
                    enrichedMessage.group = fullGroup;
                    console.log("📝 Message group enriched with admins:", fullGroup.admins?.length || 0);
                }
            }
            
            // If the message has a sender, ensure it's loaded
            if (enrichedMessage.sender && enrichedMessage.sender.id) {
                const userRepository = AppDataSource.getRepository("User");
                const fullSender = await userRepository.findOne({
                    where: { id: enrichedMessage.sender.id }
                });
                
                if (fullSender) {
                    enrichedMessage.sender = fullSender;
                }
            }
            
            return enrichedMessage;
        } catch (error) {
            console.error("Error enriching Message entity:", error);
            return messageEntity;
        }
    }

    /**
     * Called after entity insertion.
     */
    async afterInsert(event: InsertEvent<any>) {
        console.log("afterInsert?")
        let entity = event.entity;
        if (entity) {
            entity = (await this.enrichEntity(
                entity,
                event.metadata.tableName,
                event.metadata.target
            )) as ObjectLiteral;
        }
        
        // Special handling for Message entities to ensure complete data
        if (event.metadata.tableName === "messages" && entity) {
            console.log("📝 Enriching Message entity after insert");
            entity = await this.enrichMessageEntity(entity);
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
        console.log("🔍 afterUpdate triggered:", {
            hasEntity: !!event.entity,
            entityId: event.entity?.id,
            databaseEntity: event.databaseEntity?.id,
            tableName: event.metadata.tableName,
            target: event.metadata.target
        });

        // For updates, we need to reload the full entity since event.entity only contains changed fields
        let entity = event.entity;
        
        // Try different ways to get the entity ID
        let entityId = event.entity?.id || event.databaseEntity?.id;
        
        if (!entityId && event.entity) {
            // If we have the entity but no ID, try to extract it from the entity object
            const entityKeys = Object.keys(event.entity);
            console.log("🔍 Entity keys:", entityKeys);
            
            // Look for common ID field names
            entityId = event.entity.id || event.entity.Id || event.entity.ID || event.entity._id;
        }
        
        // If still no ID, try to find the entity by matching the changed data
        if (!entityId && event.entity) {
            try {
                console.log("🔍 Trying to find entity by matching changed data...");
                const repository = AppDataSource.getRepository(event.metadata.target);
                const changedData = event.entity;
                
                // For Group entities, try to find by charter content
                if (changedData.charter) {
                    console.log("🔍 Looking for group with charter content...");
                    const matchingEntity = await repository.findOne({
                        where: { charter: changedData.charter },
                        select: ['id']
                    });
                    
                    if (matchingEntity) {
                        entityId = matchingEntity.id;
                        console.log("🔍 Found entity by charter match:", entityId);
                    }
                }
            } catch (error) {
                console.log("❌ Error finding entity by changed data:", error);
            }
        }
        
        console.log("🔍 Final entityId:", entityId);
        
        if (entityId) {
            // Reload the full entity from the database
            const repository = AppDataSource.getRepository(event.metadata.target);
            const entityName = typeof event.metadata.target === 'function' 
                ? event.metadata.target.name 
                : event.metadata.target;
            
            console.log("🔍 Reloading entity:", { entityId, entityName });
            
            const fullEntity = await repository.findOne({
                where: { id: entityId },
                relations: this.getRelationsForEntity(entityName)
            });
            
            if (fullEntity) {
                console.log("✅ Full entity loaded:", { id: fullEntity.id, tableName: event.metadata.tableName });
                entity = (await this.enrichEntity(
                    fullEntity,
                    event.metadata.tableName,
                    event.metadata.target
                )) as ObjectLiteral;
                
                // Special handling for Message entities to ensure complete data
                if (event.metadata.tableName === "messages" && entity) {
                    console.log("📝 Enriching Message entity after update");
                    entity = await this.enrichMessageEntity(entity);
                }
            } else {
                console.log("❌ Could not load full entity for ID:", entityId);
            }
        } else {
            console.log("❌ No entity ID found in update event");
            console.log("🔍 Event details:", {
                entity: event.entity,
                databaseEntity: event.databaseEntity,
                metadata: event.metadata
            });
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
        console.log("yoho")
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
        console.log(data, entity)
        if (!data.id) return;
        
        // For Message entities, only process if they are system messages
        if (tableName === "messages") {
            // Check if this is a system message (starts with $$system-message$$)
            const isSystemMessage = data.content && typeof data.content === 'string' && data.content.startsWith('$$system-message$$');
            
            if (!isSystemMessage) {
                console.log("📝 Skipping non-system message:", data.id);
                return;
            }
            
            console.log("📝 Processing system message:", {
                id: data.id,
                hasGroup: !!data.group,
                groupId: data.group?.id,
                hasAdmins: !!data.group?.admins,
                adminCount: data.group?.admins?.length || 0,
                isSystemMessage: true
            });
        }
        
        console.log("hmm?")

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
                return ["followers", "following", "groups"];
            case "Group":
                return ["participants", "admins", "members"];
            case "Message":
                return ["group", "sender"];
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