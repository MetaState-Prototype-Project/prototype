import {
    EventSubscriber,
    EntitySubscriberInterface,
    InsertEvent,
    UpdateEvent,
    RemoveEvent,
} from "typeorm";
import { Web3Adapter } from "../../../../../infrastructure/web3-adapter/src/index";
import path from "path";
import dotenv from "dotenv";
import { AppDataSource } from "../../database/data-source";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });
export const adapter = new Web3Adapter({
    schemasPath: path.resolve(__dirname, "../mappings/"),
    dbPath: path.resolve(process.env.PICTIQUE_MAPPING_DB_PATH as string),
    registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
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

    /**
     * Called after entity insertion.
     */
    afterInsert(event: InsertEvent<any>) {
        this.handleChange(
            event.entity ?? event.entityId,
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
    afterUpdate(event: UpdateEvent<any>) {
        this.handleChange(
            // @ts-ignore
            event.entity ?? event.entityId,
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
    afterRemove(event: RemoveEvent<any>) {
        // Handle any post-remove processing if needed
    }

    /**
     * Process the change and send it to the Web3Adapter
     */
    private async handleChange(entity: any, tableName: string): Promise<void> {
        // Check if this is a junction table
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

        setTimeout(() => {
            try {
                if (!this.adapter.lockedIds.includes(entity.id)) {
                    this.adapter.handleChange({
                        data,
                        tableName: tableName.toLowerCase(),
                    });
                }
            } catch (error) {
                console.error(
                    `Error processing change for ${tableName}:`,
                    error
                );
            }
        }, 2_000);
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

            // Process the parent entity change
            setTimeout(() => {
                try {
                    console.log(
                        "table-name,",
                        junctionInfo.entity.toLowerCase()
                    );
                    if (!this.adapter.lockedIds.includes(parentId)) {
                        this.adapter.handleChange({
                            data: this.entityToPlain(parentEntity),
                            tableName: junctionInfo.entity.toLowerCase(),
                        });
                    }
                } catch (error) {
                    console.error(
                        `Error processing junction table change for ${junctionInfo.entity}:`,
                        error
                    );
                }
            }, 2_000);
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
