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
import axios from "axios";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });
export const adapter = new Web3Adapter({
    schemasPath: path.resolve(__dirname, "../mappings/"),
    dbPath: path.resolve(process.env.PICTIQUE_MAPPING_DB_PATH as string),
    registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
    platform: process.env.PUBLIC_PICTIQUE_BASE_URL as string,
});

// Map of junction tables to their parent entities
const JUNCTION_TABLE_MAP = {
    user_followers: { entity: "User", idField: "user_id" },
    user_following: { entity: "User", idField: "user_id" },
    post_likes: { entity: "Post", idField: "post_id" },
    comment_likes: { entity: "Comment", idField: "comment_id" },
    chat_participants: { entity: "Chat", idField: "chat_id" },
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
            event.metadata.tableName
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
            event.metadata.tableName
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
            event.metadata.tableName
        );
    }

    /**
     * Process the change and send it to the Web3Adapter
     */
    private async handleChange(entity: any, tableName: string): Promise<void> {
        // Check if this is a junction table
        if (tableName === "message_read_status") return;
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

        let globalId = await this.adapter.mappingDb.getGlobalId({
            localId: entity.id,
            tableName: tableName.toLowerCase(),
        });
        globalId = globalId ?? "";

        // Use immediate locking instead of setTimeout to prevent race conditions
        try {
            // Check if either local or global ID is already locked
            if (this.adapter.lockedIds.includes(entity.id)) {
                console.log(`Local ID ${entity.id} already locked, skipping`);
                return;
            }
            
            if (globalId && this.adapter.lockedIds.includes(globalId)) {
                console.log(`Global ID ${globalId} already locked, skipping`);
                return;
            }

            // Try to lock the local ID atomically
            if (!this.adapter.addToLockedIds(entity.id)) {
                console.log(`Failed to lock local ID ${entity.id}, skipping`);
                return;
            }

            // Also lock the global ID if it exists
            if (globalId) {
                this.adapter.addToLockedIds(globalId);
            }

            console.log(
                "sending packet for global Id",
                globalId,
                entity.id
            );
            const envelope = await this.adapter.handleChange({
                data,
                tableName: tableName.toLowerCase(),
            });
        } catch (error) {
            console.error(
                `Error processing change for ${tableName}:`,
                error
            );
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

            // Get the parent entity repository
            // GET THE REPOSITORY FROM ENTITY VIA THE MAIN THINGY AND THEN THIS
            // PART IS TAKEN CARE OF, TEST MESSAGES & CHAT & STUFF TOMORROW
            const repository = AppDataSource.getRepository(junctionInfo.entity);
            const parentEntity = await repository.findOne({
                where: { id: parentId },
                relations: this.getRelationsForEntity(junctionInfo.entity),
            });

            if (!parentEntity) {
                console.error(`Parent entity not found: ${parentId}`);
                return;
            }

            let globalId = await this.adapter.mappingDb.getGlobalId({
                localId: entity.id,
                tableName: junctionInfo.entity.toLowerCase() + "s",
            });
            globalId = globalId ?? "";

            const tableName = junctionInfo.entity.toLowerCase() + "s";
            
            // Use immediate locking instead of setTimeout to prevent race conditions
            try {
                // Check if either local or global ID is already locked
                if (this.adapter.lockedIds.includes(entity.id)) {
                    console.log(`Local ID ${entity.id} already locked, skipping junction change`);
                    return;
                }
                
                if (globalId && this.adapter.lockedIds.includes(globalId)) {
                    console.log(`Global ID ${globalId} already locked, skipping junction change`);
                    return;
                }

                // Try to lock the local ID atomically
                if (!this.adapter.addToLockedIds(entity.id)) {
                    console.log(`Failed to lock local ID ${entity.id}, skipping junction change`);
                    return;
                }

                // Also lock the global ID if it exists
                if (globalId) {
                    this.adapter.addToLockedIds(globalId);
                }

                console.log(
                    "sending packet for global Id",
                    globalId,
                    entity.id
                );
                const envelope = await this.adapter.handleChange({
                    data: this.entityToPlain(parentEntity),
                    tableName: junctionInfo.entity.toLowerCase() + "s",
                });
            } catch (error) {
                console.error(
                    `Error processing change for ${tableName}:`,
                    error
                );
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
                return ["followers", "following", "posts", "comments", "chats"];
            case "Post":
                return ["author", "likedBy", "comments"];
            case "Comment":
                return ["author", "post", "likedBy"];
            case "Chat":
                return ["participants", "messages"];
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
