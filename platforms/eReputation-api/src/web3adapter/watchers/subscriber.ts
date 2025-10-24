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
    dbPath: path.resolve(process.env.EREPUTATION_MAPPING_DB_PATH as string),
    registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
    platform: process.env.VITE_EREPUTATION_BASE_URL as string,
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
    private junctionTableDebounceMap: Map<string, NodeJS.Timeout> = new Map();

    constructor() {
        console.log("🚀 PostgresSubscriber constructor called - subscriber is being instantiated");
        this.adapter = adapter;
    }

    /**
     * Called before entity insertion.
     */
    beforeInsert(event: InsertEvent<any>) {
 
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
        // For updates, we need to reload the full entity since event.entity only contains changed fields
        let entity = event.entity;
        
        // Try different ways to get the entity ID
        let entityId = event.entity?.id || event.databaseEntity?.id;
        
        if (!entityId && event.entity) {
            // If we have the entity but no ID, try to extract it from the entity object
            const entityKeys = Object.keys(event.entity);
            
            // Look for common ID field names
            entityId = event.entity.id || event.entity.Id || event.entity.ID || event.entity._id;
        }
        
        if (entityId) {
            // Reload the full entity from the database
            const repository = AppDataSource.getRepository(event.metadata.target);
            const entityName = typeof event.metadata.target === 'function' 
                ? event.metadata.target.name 
                : event.metadata.target;
            
            const fullEntity = await repository.findOne({
                where: { id: entityId },
                relations: this.getRelationsForEntity(entityName)
            });
            
            if (fullEntity) {
                entity = (await this.enrichEntity(
                    fullEntity,
                    event.metadata.tableName,
                    event.metadata.target
                )) as ObjectLiteral;
            }
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
        console.log(`🔍 handleChange called for: ${tableName}, entityId: ${entity?.id}`);
        
        // Handle junction table changes
        // @ts-ignore
        const junctionInfo = JUNCTION_TABLE_MAP[tableName];
        if (junctionInfo) {
            console.log(`🔗 Processing junction table change for: ${tableName}`);
            await this.handleJunctionTableChange(entity, junctionInfo);
            return;
        }
        
        // Handle regular entity changes with debouncing for groups
        const data = this.entityToPlain(entity);
        if (!data.id) return;
        
        // Add debouncing for group entities to prevent duplicate webhooks
        if (tableName === "groups") {
            const debounceKey = `group:${data.id}`;
            console.log(`🔍 Group debounce key: ${debounceKey}`);
            
            // Clear existing timeout for this group
            if (this.junctionTableDebounceMap.has(debounceKey)) {
                console.log(`🔍 Clearing existing group timeout for: ${debounceKey}`);
                clearTimeout(this.junctionTableDebounceMap.get(debounceKey)!);
            }
            
            // Set new timeout
            const timeoutId = setTimeout(async () => {
                try {
                    console.log(`🔍 Executing debounced group webhook for: ${debounceKey}`);
                    await this.sendGroupWebhook(data);
                    this.junctionTableDebounceMap.delete(debounceKey);
                    console.log(`🔍 Completed group webhook for: ${debounceKey}`);
                } catch (error) {
                    console.error("Error in group timeout:", error);
                    this.junctionTableDebounceMap.delete(debounceKey);
                }
            }, 3_000);
            
            // Store the timeout ID
            this.junctionTableDebounceMap.set(debounceKey, timeoutId);
            return;
        }

        try {
            setTimeout(async () => {
                let globalId = await this.adapter.mappingDb.getGlobalId(
                    entity.id
                );
                globalId = globalId ?? "";

                if (this.adapter.lockedIds.includes(globalId)) {
                    return;
                }

                // Check if this entity was recently created by a webhook
                if (this.adapter.lockedIds.includes(entity.id)) {
                    return;
                }

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

            // Use debouncing to prevent multiple webhook packets for the same group
            const debounceKey = `${junctionInfo.entity}:${parentId}`;
            
            console.log(`🔗 Junction table debounce key: ${debounceKey}`);
            
            // Clear existing timeout for this group
            if (this.junctionTableDebounceMap.has(debounceKey)) {
                console.log(`🔗 Clearing existing timeout for: ${debounceKey}`);
                clearTimeout(this.junctionTableDebounceMap.get(debounceKey)!);
            }

            // Set new timeout
            const timeoutId = setTimeout(async () => {
                try {
                    console.log(`🔗 Executing debounced webhook for: ${debounceKey}`);
                    let globalId = await this.adapter.mappingDb.getGlobalId(
                        entity.id
                    );
                    globalId = globalId ?? "";

                    if (this.adapter.lockedIds.includes(globalId)) {
                        console.log(`🔗 GlobalId ${globalId} is locked, skipping`);
                        return;
                    }

                    const tableName = `${junctionInfo.entity.toLowerCase()}s`;
                    console.log(`🔗 Sending webhook packet for group: ${parentId}, tableName: ${tableName}`);
                    await this.adapter.handleChange({
                        data: this.entityToPlain(parentEntity),
                        tableName,
                    });
                    
                    // Remove from debounce map after processing
                    this.junctionTableDebounceMap.delete(debounceKey);
                    console.log(`🔗 Completed webhook for: ${debounceKey}`);
                } catch (error) {
                    console.error("Error in junction table timeout:", error);
                    this.junctionTableDebounceMap.delete(debounceKey);
                }
            }, 3_000);
            
            // Store the timeout ID for potential cancellation
            this.junctionTableDebounceMap.set(debounceKey, timeoutId);
        } catch (error) {
            console.error("Error handling junction table change:", error);
        }
    }

    /**
     * Send webhook for group entity
     */
    private async sendGroupWebhook(data: any): Promise<void> {
        try {
            let globalId = await this.adapter.mappingDb.getGlobalId(data.id);
            globalId = globalId ?? "";

            if (this.adapter.lockedIds.includes(globalId)) {
                console.log(`🔍 Group globalId ${globalId} is locked, skipping`);
                return;
            }

            console.log(`🔍 Sending group webhook for: ${data.id}, tableName: groups`);
            await this.adapter.handleChange({
                data,
                tableName: "groups",
            });
        } catch (error) {
            console.error("Error sending group webhook:", error);
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
                return ["participants", "admins", "members"];
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
