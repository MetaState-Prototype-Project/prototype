import {
    EventSubscriber,
    EntitySubscriberInterface,
    InsertEvent,
    UpdateEvent,
    RemoveEvent,
    ObjectLiteral,
} from "typeorm";
import { Web3Adapter } from "web3-adapter";
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
     * NOTE: We pass metadata to handleChangeWithReload so the entity reload happens
     * AFTER the transaction commits (inside setTimeout), avoiding stale/partial reads.
     */
    async afterUpdate(event: UpdateEvent<any>) {
        // Try different ways to get the entity ID
        let entityId = event.entity?.id || event.databaseEntity?.id;
        
        if (!entityId && event.entity) {
            // Look for common ID field names
            entityId = event.entity.id || event.entity.Id || event.entity.ID || event.entity._id;
        }
        
        if (!entityId) {
            console.warn(`⚠️ afterUpdate: Could not determine entity ID for ${event.metadata.tableName}`);
            return;
        }
        
        const entityName = typeof event.metadata.target === 'function' 
            ? event.metadata.target.name 
            : event.metadata.target;
        
        const tableName = event.metadata.tableName.endsWith("s")
            ? event.metadata.tableName
            : event.metadata.tableName + "s";
        
        // Pass reload metadata instead of entity - actual DB read happens in setTimeout
        this.handleChangeWithReload({
            entityId,
            tableName,
            relations: this.getRelationsForEntity(entityName),
            tableTarget: event.metadata.target,
            rawTableName: event.metadata.tableName,
        });
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
        // For remove events, we only have the entityId, not the full entity
        // We'll handle this differently to avoid errors
        const tableName = event.metadata.tableName.endsWith("s")
            ? event.metadata.tableName
            : event.metadata.tableName + "s";
        
        console.log(`Entity removed from ${tableName} with ID: ${event.entityId}`);
        
        // For now, we'll skip processing removed entities in the web3adapter
        // since we don't have the full entity data to work with
        // This prevents the error when trying to access entity.id
    }

    /**
     * Handle update changes by reloading entity AFTER transaction commits.
     * This avoids stale/partial reads that occur when we use event.entity which only contains changed fields.
     */
    private async handleChangeWithReload(params: {
        entityId: string;
        tableName: string;
        relations: string[];
        tableTarget: any;
        rawTableName: string;
    }): Promise<void> {
        const { entityId, tableName, relations, tableTarget, rawTableName } = params;

        console.log(`🔍 handleChangeWithReload called for: ${tableName}, entityId: ${entityId}`);

        // Check if this is a junction table - skip for now
        if (tableName === "group_participants") {
            return;
        }

        // @ts-ignore
        const junctionInfo = JUNCTION_TABLE_MAP[tableName];
        if (junctionInfo) {
            // Junction tables handled separately
            return;
        }

        // Small delay to ensure transaction has committed before we read
        // Groups and messages sync quickly (50ms), other entities use standard delay
        const delayMs = (tableName.toLowerCase() === "groups" || tableName.toLowerCase() === "messages") ? 50 : 3_000;

        setTimeout(async () => {
            try {
                await this.executeReloadAndSend(params);
            } catch (error) {
                console.error(`❌ Error in handleChangeWithReload setTimeout for ${tableName}:`, error);
            }
        }, delayMs);
    }

    /**
     * Execute the entity reload and send webhook - called from within setTimeout
     * when transaction has definitely committed.
     */
    private async executeReloadAndSend(params: {
        entityId: string;
        tableName: string;
        relations: string[];
        tableTarget: any;
        rawTableName: string;
    }): Promise<void> {
        const { entityId, tableName, relations, tableTarget, rawTableName } = params;

        // NOW reload entity - transaction has committed, data is fresh and complete
        const repository = AppDataSource.getRepository(tableTarget);
        let entity = await repository.findOne({
            where: { id: entityId },
            relations: relations.length > 0 ? relations : undefined
        });

        if (!entity) {
            console.warn(`⚠️ executeReloadAndSend: Entity ${entityId} not found after reload`);
            return;
        }

        // Enrich entity with additional data
        entity = (await this.enrichEntity(
            entity,
            rawTableName,
            tableTarget
        )) as ObjectLiteral;

        // Convert to plain data
        const data = this.entityToPlain(entity);
        
        if (!data.id) {
            return;
        }

        // For Message entities, only process system messages
        if (tableName === "messages") {
            const isSystemMessage = data.text && data.text.includes('$$system-message$$');
            if (!isSystemMessage) {
                return;
            }
        }

        let globalId = await this.adapter.mappingDb.getGlobalId(entityId);
        globalId = globalId ?? "";

        if (this.adapter.lockedIds.includes(globalId)) {
            console.log("Entity already locked, skipping:", globalId, entityId);
            return;
        }

        if (this.adapter.lockedIds.includes(entityId)) {
            console.log("Local entity locked (webhook created), skipping:", entityId);
            return;
        }

        console.log(
            "sending packet for global Id",
            globalId,
            entityId,
            "table:",
            tableName
        );

        // Log the full data being sent for system messages
        if (tableName === "messages") {
            console.log("📤 [SUBSCRIBER] Sending message data:");
            console.log("  - Data keys:", Object.keys(data));
            console.log("  - Data.sender:", data.sender);
            console.log("  - Data.group:", data.group ? `Group ID: ${data.group.id}` : "null");
            console.log("  - Data.text (first 100):", data.text?.substring(0, 100));
            console.log("  - Data.isSystemMessage:", data.isSystemMessage);
        }

        const envelope = await this.adapter.handleChange({
            data,
            tableName: tableName.toLowerCase(),
        });
        console.log("📥 [SUBSCRIBER] Envelope response:", envelope);
    }

    /**
     * Handle entity changes and send to web3adapter
     */
    private async handleChange(entity: any, tableName: string): Promise<void> {
        // Safety check: ensure entity exists and has an id
        if (!entity || !entity.id) {
            console.log(`Skipping handleChange for ${tableName}: entity or entity.id is missing`);
            return;
        }
        
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
        
        // For Message entities, only process if they are system messages
        if (tableName === "messages") {
            // Check if this is a system message (starts with $$system-message$$)
            const isSystemMessage = data.text && data.text.includes('$$system-message$$');

            
            if (!isSystemMessage) {
                return;
            }
        }

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
                
                // Log the full data being sent for system messages
                if (tableName === "messages") {
                    console.log("📤 [SUBSCRIBER] Sending message data:");
                    console.log("  - Data keys:", Object.keys(data));
                    console.log("  - Data.sender:", data.sender);
                    console.log("  - Data.group:", data.group ? `Group ID: ${data.group.id}` : "null");
                    console.log("  - Data.text (first 100):", data.text?.substring(0, 100));
                    console.log("  - Data.isSystemMessage:", data.isSystemMessage);
                }
                
                const envelope = await this.adapter.handleChange({
                    data,
                    tableName: tableName.toLowerCase(),
                });
                console.log("📥 [SUBSCRIBER] Envelope response:", envelope)
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
            case "CharterSignature":
                return ["user", "group"];
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