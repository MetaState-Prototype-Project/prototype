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
    dbPath: path.resolve(process.env.FILE_MANAGER_MAPPING_DB_PATH as string),
    registryUrl: process.env.PUBLIC_REGISTRY_URL as string,
    platform: process.env.PUBLIC_FILE_MANAGER_BASE_URL as string,
});

@EventSubscriber()
export class PostgresSubscriber implements EntitySubscriberInterface {
    private adapter: Web3Adapter;
    private pendingChanges: Map<string, number> = new Map();

    constructor() {
        this.adapter = adapter;

        setInterval(() => {
            this.cleanupOldPendingChanges();
        }, 5 * 60 * 1000);
    }

    private cleanupOldPendingChanges(): void {
        const now = Date.now();
        const maxAge = 10 * 60 * 1000;

        for (const [key, timestamp] of this.pendingChanges.entries()) {
            if (now - timestamp > maxAge) {
                this.pendingChanges.delete(key);
            }
        }
    }

    async enrichEntity(entity: any, tableName: string, tableTarget: any) {
        try {
            const enrichedEntity = { ...entity };

            // Special handling for File entities to ensure owner relation is loaded
            if (tableName === "files" && (entity.ownerId || entity.owner)) {
                const ownerId = entity.owner?.id || entity.ownerId;
                if (ownerId) {
                    const owner = await AppDataSource.getRepository("User").findOne({
                        where: { id: ownerId },
                        select: ["id", "ename", "name"]
                    });
                    if (owner) {
                        enrichedEntity.owner = owner;
                    }
                }
            }

            // Special handling for SignatureContainer entities to ensure file and user relations are loaded
            if (tableName === "signature_containers") {
                if (entity.fileId || entity.file?.id) {
                    const fileId = entity.file?.id || entity.fileId;
                    const file = await AppDataSource.getRepository("File").findOne({
                        where: { id: fileId },
                        relations: ["owner"]
                    });
                    if (file) {
                        enrichedEntity.file = file;
                    }
                }
                if (entity.userId || entity.user?.id) {
                    const userId = entity.user?.id || entity.userId;
                    const user = await AppDataSource.getRepository("User").findOne({
                        where: { id: userId },
                        select: ["id", "ename", "name"]
                    });
                    if (user) {
                        enrichedEntity.user = user;
                    }
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

    async afterInsert(event: InsertEvent<any>) {
        console.log(`📥 afterInsert called for table: ${event.metadata.tableName}`);
        let entity = event.entity;
        
        // For files and signatures, reload with relations to ensure owner/user are loaded
        if (entity && (event.metadata.tableName === "files" || event.metadata.tableName === "signature_containers")) {
            const entityId = entity.id;
            if (entityId) {
                const repository = AppDataSource.getRepository(event.metadata.target);
                let relations: string[] = [];
                
                if (event.metadata.tableName === "files") {
                    relations = ["owner"];
                } else if (event.metadata.tableName === "signature_containers") {
                    relations = ["file", "user", "file.owner"];
                }
                
                const fullEntity = await repository.findOne({
                    where: { id: entityId },
                    relations: relations.length > 0 ? relations : undefined
                });
                
                if (fullEntity) {
                    entity = fullEntity;
                }
            }
        }
        
        if (entity) {
            entity = (await this.enrichEntity(
                entity,
                event.metadata.tableName,
                event.metadata.target
            )) as ObjectLiteral;
        }
        
        // Special handling for Message entities to ensure complete data
        if (event.metadata.tableName === "messages" && entity) {
            entity = await this.enrichMessageEntity(entity);
        }
        
        const tableName = event.metadata.tableName.endsWith("s")
            ? event.metadata.tableName
            : event.metadata.tableName + "s";
        
        console.log(`📥 Processing insert for table: ${tableName}, entityId: ${entity?.id || event.entityId}`);
        this.handleChange(
            entity ?? event.entityId,
            tableName
        );
    }

    async afterUpdate(event: UpdateEvent<any>) {
        // For updates, we pass metadata to handleChange so the entity reload happens
        // AFTER the transaction commits (inside setTimeout), avoiding stale reads
        
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
        
        // Determine relations based on entity type
        let relations: string[] = [];
        if (event.metadata.tableName === "messages") {
            relations = ["sender", "group", "group.members", "group.admins", "group.participants"];
        } else if (event.metadata.tableName === "groups") {
            relations = ["members", "admins", "participants"];
        } else if (event.metadata.tableName === "files") {
            relations = ["owner", "folder", "signatures", "tags"];
        } else if (event.metadata.tableName === "signature_containers") {
            relations = ["file", "user"];
        }
        
        const tableName = event.metadata.tableName.endsWith("s")
            ? event.metadata.tableName
            : event.metadata.tableName + "s";
        
        // Pass reload metadata instead of entity - actual DB read happens in setTimeout
        this.handleChangeWithReload({
            entityId,
            tableName,
            relations,
            tableTarget: event.metadata.target,
            rawTableName: event.metadata.tableName,
        });
    }

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
            entity ?? event.entityId,
            event.metadata.tableName
        );
    }

    /**
     * Handle update changes by reloading entity AFTER transaction commits.
     * This avoids stale reads that occur when findOne runs inside the same transaction.
     */
    private async handleChangeWithReload(params: {
        entityId: string;
        tableName: string;
        relations: string[];
        tableTarget: any;
        rawTableName: string;
    }): Promise<void> {
        const { entityId, tableName, relations, tableTarget, rawTableName } = params;

        if (!entityId) {
            return;
        }

        // Check if there's a mapping for this table
        const mapping = Object.values(this.adapter.mapping).find(
            (m) => m.tableName === tableName.toLowerCase()
        );
        
        if (!mapping) {
            return;
        }

        const changeKey = `${tableName}:${entityId}`;

        if (this.pendingChanges.has(changeKey)) {
            return;
        }

        this.pendingChanges.set(changeKey, Date.now());

        // Small delay to ensure transaction has committed before we read
        // Files sync quickly (50ms), other tables batch changes (3s)
        const delayMs = tableName.toLowerCase() === "files" ? 50 : 3_000;

        try {
            setTimeout(async () => {
                try {
                    // NOW reload entity - transaction has committed, data is fresh
                    const repository = AppDataSource.getRepository(tableTarget);
                    let entity = await repository.findOne({
                        where: { id: entityId },
                        relations: relations.length > 0 ? relations : undefined
                    });

                    if (!entity) {
                        console.warn(`⚠️ handleChangeWithReload: Entity ${entityId} not found after reload`);
                        return;
                    }

                    // Enrich entity with additional relations
                    entity = (await this.enrichEntity(
                        entity,
                        rawTableName,
                        tableTarget
                    )) as ObjectLiteral;

                    // Special handling for Message entities
                    if (rawTableName === "messages" && entity) {
                        entity = await this.enrichMessageEntity(entity);
                    }

                    const data = this.entityToPlain(entity);
                    if (!data.id) {
                        return;
                    }

                    let globalId = await this.adapter.mappingDb.getGlobalId(entityId);
                    globalId = globalId ?? "";

                    if (this.adapter.lockedIds.includes(globalId)) {
                        return;
                    }

                    // Check if this entity was recently created by a webhook
                    if (this.adapter.lockedIds.includes(entityId)) {
                        return;
                    }

                    const envelope = await this.adapter.handleChange({
                        data,
                        tableName: tableName.toLowerCase(),
                    });
                } catch (error) {
                    console.error(`❌ Error in handleChangeWithReload setTimeout for ${tableName}:`, error);
                } finally {
                    this.pendingChanges.delete(changeKey);
                }
            }, delayMs);
        } catch (error) {
            console.error(`❌ Error processing change with reload for ${tableName}:`, error);
            this.pendingChanges.delete(changeKey);
        }
    }

    private async handleChange(entity: any, tableName: string): Promise<void> {
        if (!entity || !entity.id) {
            return;
        }

        // Check if there's a mapping for this table
        const mapping = Object.values(this.adapter.mapping).find(
            (m) => m.tableName === tableName.toLowerCase()
        );
        
        if (!mapping) {
            return;
        }

        const data = this.entityToPlain(entity);
        if (!data.id) {
            return;
        }

        const changeKey = `${tableName}:${entity.id}`;

        if (this.pendingChanges.has(changeKey)) {
            return;
        }

        this.pendingChanges.set(changeKey, Date.now());

        // Sync file renames/updates immediately; other tables keep 3s delay to batch rapid changes
        const delayMs = tableName.toLowerCase() === "files" ? 0 : 3_000;

        try {
            setTimeout(async () => {
                try {
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
                } catch (error) {
                    console.error(`❌ Error in setTimeout for ${tableName}:`, error);
                } finally {
                    this.pendingChanges.delete(changeKey);
                }
            }, delayMs);
        } catch (error) {
            console.error(`❌ Error processing change for ${tableName}:`, error);
            this.pendingChanges.delete(changeKey);
        }
    }

    private entityToPlain(entity: any): any {
        if (!entity) return {};

        if (typeof entity !== "object" || entity === null) {
            return entity;
        }

        if (entity instanceof Date) {
            return entity.toISOString();
        }

        // Handle Buffer objects - convert to base64
        if (Buffer.isBuffer(entity)) {
            return entity.toString("base64");
        }

        if (Array.isArray(entity)) {
            return entity.map((item) => this.entityToPlain(item));
        }

        const plain: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(entity)) {
            if (key.startsWith("_")) continue;

            if (value && typeof value === "object") {
                if (Array.isArray(value)) {
                    plain[key] = value.map((item) => this.entityToPlain(item));
                } else if (value instanceof Date) {
                    plain[key] = value.toISOString();
                } else if (Buffer.isBuffer(value)) {
                    // Convert Buffer to base64 string
                    plain[key] = value.toString("base64");
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

