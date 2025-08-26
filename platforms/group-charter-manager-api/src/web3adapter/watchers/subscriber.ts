import {
    EventSubscriber,
    EntitySubscriberInterface,
    InsertEvent,
    UpdateEvent,
    RemoveEvent,
    ObjectLiteral,
} from "typeorm";
import { Web3Adapter } from "../../../../../infrastructure/web3-adapter/src/index";
import { createGroupEVault } from "../../../../../infrastructure/web3-adapter/src/index";
import path from "path";
import dotenv from "dotenv";
import { AppDataSource } from "../../database/data-source";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });
export const adapter = new Web3Adapter({
    schemasPath: path.resolve(__dirname, "../mappings/"),
    dbPath: path.resolve(process.env.GROUP_CHARTER_MAPPING_DB_PATH as string),
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

            console.log("ENRICHING,", tableName)

            // Special handling for charter signatures: always load the user and substitute at userId
            if (tableName === "charter_signature" && entity.userId) {
                const user = await AppDataSource.getRepository(
                    "User"
                ).findOne({ where: { id: entity.userId } });
                if (user) {
                    enrichedEntity.userId = user;
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
        console.log("afterInsert?")
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
                
                if (entityName === "Group" && fullEntity.charter && fullEntity.charter.trim() !== "") {
                    console.log("✅ Group entity with charter detected");
                    
                    // Check if this group doesn't have an ename yet (meaning eVault wasn't created)
                    if (!fullEntity.ename) {
                        console.log("🎯 eVault creation conditions met! Group:", fullEntity.id, "needs eVault");
                        
                        // Fire and forget eVault creation
                        this.spinUpGroupEVault(fullEntity).catch(error => {
                            console.error("Failed to create eVault for group:", fullEntity.id, error);
                        });
                    } else {
                        console.log("⚠️ Group already has ename, skipping eVault creation:", fullEntity.ename);
                    }
                } else {
                    console.log("❌ eVault conditions not met:", {
                        isGroup: entityName === "Group",
                        hasCharter: !!fullEntity.charter,
                        charterNotEmpty: fullEntity.charter ? fullEntity.charter.trim() !== "" : false,
                        hasEname: !!fullEntity.ename
                    });
                }
                
                entity = (await this.enrichEntity(
                    fullEntity,
                    event.metadata.tableName,
                    event.metadata.target
                )) as ObjectLiteral;
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
                return ["followers", "following"];
            case "Group":
                return ["participants"];
            case "CharterSignature":
                return ["user", "group"];
            default:
                return [];
        }
    }

    /**
     * Spin up eVault for a newly chartered group
     */
    private async spinUpGroupEVault(group: any): Promise<void> {
        try {
            console.log("Starting eVault creation for group:", group.id);
            
            // Get environment variables for eVault creation
            const registryUrl = process.env.PUBLIC_REGISTRY_URL;
            const provisionerUrl = process.env.PUBLIC_PROVISIONER_URL;
            
            if (!registryUrl || !provisionerUrl) {
                throw new Error("Missing required environment variables for eVault creation");
            }
            
            // Prepare group data for eVault creation
            const groupData = {
                name: group.name || "Unnamed Group",
                avatar: group.avatarUrl,
                description: group.description,
                members: group.participants?.map((p: any) => p.id) || [],
                admins: group.admins || [],
                owner: group.owner,
                charter: group.charter
            };
            
            console.log("Creating eVault with data:", groupData);
            
            // Create the eVault (this is the long-running operation)
            const evaultResult = await createGroupEVault(
                registryUrl,
                provisionerUrl,
                groupData
            );
            
            console.log("eVault created successfully:", evaultResult);
            
            // Update the group with the ename (w3id)
            const groupRepository = AppDataSource.getRepository("Group");
            await groupRepository.update(group.id, { ename: evaultResult.w3id });
            
            console.log("Group updated with ename:", evaultResult.w3id);
            
            // Wait 20 seconds before triggering handleChange to allow eVault to stabilize
            console.log("Waiting 20 seconds before syncing updated group data...");
            setTimeout(async () => {
                try {
                    // Fetch the updated group entity with relations to trigger handleChange
                    const updatedGroup = await groupRepository.findOne({ 
                        where: { id: group.id },
                        relations: this.getRelationsForEntity("Group")
                    });
                    if (updatedGroup) {
                        console.log("Triggering handleChange for updated group with ename after timeout");
                        await this.handleChange(updatedGroup, "groups");
                    }
                } catch (error) {
                    console.error("Error triggering handleChange after timeout for group:", group.id, error);
                }
            }, 20000); // 20 seconds timeout
            
        } catch (error: any) {
            console.error("Error creating eVault for group:", group.id, error);
            throw error; // Re-throw to be caught by the caller
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