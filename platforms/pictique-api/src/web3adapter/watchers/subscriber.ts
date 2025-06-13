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

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });
export const adapter = new Web3Adapter({
    schemasPath: path.resolve(__dirname, "../mappings/"),
    dbPath: path.resolve(process.env.PICTIQUE_MAPPING_DB_PATH as string),
    registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
});

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
        this.handleChange(event.entity, event.metadata.tableName);
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
        this.handleChange(event.entity, event.metadata.tableName);
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
    private handleChange(entity: any, tableName: string): void {
        try {
            // Convert the entity to a plain object
            const data = this.entityToPlain(entity);
            if (!entity.id) return;

            // Send to Web3Adapter

            if (!this.adapter.lockedIds.includes(entity.id)) {
                this.adapter.handleChange({
                    data,
                    tableName: tableName.toLowerCase(), // Ensure table name is lowercase to match mapping files
                });
            }
        } catch (error) {
            console.error(`Error processing change for ${tableName}:`, error);
        }
    }

    /**
     * Convert TypeORM entity to plain object
     */
    private entityToPlain(entity: any): Record<string, unknown> {
        if (!entity) return {};

        // If it's already a plain object, return it
        if (typeof entity !== "object" || entity === null) {
            return { value: entity };
        }

        // Handle Date objects
        if (entity instanceof Date) {
            return { value: entity.toISOString() };
        }

        // Convert entity to plain object
        const plain: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(entity)) {
            // Skip private properties and methods
            if (key.startsWith("_")) continue;

            // Handle nested objects
            if (
                value &&
                typeof value === "object" &&
                !(value instanceof Date)
            ) {
                plain[key] = this.entityToPlain(value);
            } else {
                plain[key] = value;
            }
        }

        return plain;
    }
}
