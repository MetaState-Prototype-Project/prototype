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
    private adapter: Web3Adapter;

    constructor() {
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

            // Special handling for Poll entities to ensure group with ename is loaded
            if (tableName === "polls" && (entity.groupId || entity.group)) {
                const groupRepository = AppDataSource.getRepository("Group");
                const groupId = entity.group?.id || entity.groupId;
                
                if (groupId) {
                    const fullGroup = await groupRepository.findOne({
                        where: { id: groupId },
                        select: ["id", "ename", "name"]
                    });
                    
                    if (fullGroup) {
                        enrichedEntity.group = fullGroup;
                    }
                }
            }

            // Special handling for Vote entities to ensure poll and group are loaded
            if (tableName === "votes" && (entity.pollId || entity.poll)) {
                const pollRepository = AppDataSource.getRepository("Poll");
                const groupRepository = AppDataSource.getRepository("Group");
                const pollId = entity.poll?.id || entity.pollId;
                
                if (pollId) {
                    const fullPoll = await pollRepository.findOne({
                        where: { id: pollId },
                        relations: ["group"]
                    });
                    
                    if (fullPoll) {
                        enrichedEntity.poll = fullPoll;
                        
                        // If poll has groupId, load the group with ename
                        if (fullPoll.groupId) {
                            const fullGroup = await groupRepository.findOne({
                                where: { id: fullPoll.groupId },
                                select: ["id", "ename", "name"]
                            });
                            
                            if (fullGroup) {
                                enrichedEntity.poll.group = fullGroup;
                            }
                        }
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

    /**
     * Special enrichment method for Poll entities to ensure group with ename is loaded
     */
    private async enrichPollEntity(pollEntity: any): Promise<any> {
        try {
            const enrichedPoll = { ...pollEntity };
            const groupRepository = AppDataSource.getRepository("Group");
            
            // Load group if we have groupId or group reference
            const groupId = enrichedPoll.group?.id || enrichedPoll.groupId;
            if (groupId) {
                const fullGroup = await groupRepository.findOne({
                    where: { id: groupId },
                    select: ["id", "ename", "name"]
                });
                
                if (fullGroup) {
                    enrichedPoll.group = fullGroup;
                }
            }
            
            return enrichedPoll;
        } catch (error) {
            console.error("Error enriching Poll entity:", error);
            return pollEntity;
        }
    }

    /**
     * Special enrichment method for Vote entities to ensure poll and group are loaded
     */
    private async enrichVoteEntity(voteEntity: any): Promise<any> {
        try {
            const enrichedVote = { ...voteEntity };
            const pollRepository = AppDataSource.getRepository("Poll");
            const groupRepository = AppDataSource.getRepository("Group");
            
            // Load poll if we have pollId or poll reference
            const pollId = enrichedVote.poll?.id || enrichedVote.pollId;
            if (pollId) {
                const fullPoll = await pollRepository.findOne({
                    where: { id: pollId },
                    relations: ["group"]
                });
                
                if (fullPoll) {
                    enrichedVote.poll = fullPoll;
                    
                    // If poll has groupId, load the group with ename
                    if (fullPoll.groupId) {
                        const fullGroup = await groupRepository.findOne({
                            where: { id: fullPoll.groupId },
                            select: ["id", "ename", "name"]
                        });
                        
                        if (fullGroup) {
                            enrichedVote.poll.group = fullGroup;
                        }
                    }
                }
            }
            
            return enrichedVote;
        } catch (error) {
            console.error("Error enriching Vote entity:", error);
            return voteEntity;
        }
    }

    /**
     * Called after entity insertion.
     */
    async afterInsert(event: InsertEvent<any>) {
        const tableName = event.metadata.tableName.endsWith("s")
            ? event.metadata.tableName
            : event.metadata.tableName + "s";
        
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
            entity = await this.enrichMessageEntity(entity);
        }
        
        // Special handling for Poll entities to ensure group is loaded
        if (event.metadata.tableName === "polls" && entity) {
            entity = await this.enrichPollEntity(entity);
        }
        
        // Special handling for Vote entities to ensure poll and group are loaded
        if (event.metadata.tableName === "votes" && entity) {
            entity = await this.enrichVoteEntity(entity);
        }
        
        await this.handleChange(
            // @ts-ignore
            entity ?? event.entityId,
            tableName
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
        const tableName = event.metadata.tableName.endsWith("s")
            ? event.metadata.tableName
            : event.metadata.tableName + "s";

        // For updates, we need to reload the full entity since event.entity only contains changed fields
        let entity = event.entity;
        
        // Try different ways to get the entity ID
        let entityId = event.entity?.id || event.databaseEntity?.id;
        
        if (!entityId && event.entity) {
            // Look for common ID field names
            entityId = event.entity.id || event.entity.Id || event.entity.ID || event.entity._id;
        }
        
        // If still no ID, try to find the entity by matching the changed data
        if (!entityId && event.entity) {
            try {
                const repository = AppDataSource.getRepository(event.metadata.target);
                const changedData = event.entity;
                
                // For Group entities, try to find by charter content
                if (changedData.charter) {
                    const matchingEntity = await repository.findOne({
                        where: { charter: changedData.charter },
                        select: ['id']
                    });
                    
                    if (matchingEntity) {
                        entityId = matchingEntity.id;
                    }
                }
            } catch (error) {
                // Ignore errors
            }
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
                
                // Special handling for Message entities to ensure complete data
                if (event.metadata.tableName === "messages" && entity) {
                    entity = await this.enrichMessageEntity(entity);
                }
                
                // Special handling for Poll entities to ensure group is loaded
                if (event.metadata.tableName === "polls" && entity) {
                    entity = await this.enrichPollEntity(entity);
                }
                
                // Special handling for Vote entities to ensure poll and group are loaded
                if (event.metadata.tableName === "votes" && entity) {
                    entity = await this.enrichVoteEntity(entity);
                }
            }
        }
        
        await this.handleChange(
            // @ts-ignore
            entity ?? event.entityId,
            tableName
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
        const tableName = event.metadata.tableName.endsWith("s")
            ? event.metadata.tableName
            : event.metadata.tableName + "s";
        
        await this.handleChange(
            // @ts-ignore
            event.entityId,
            tableName
        );
    }

    /**
     * Handle entity changes and send to web3adapter
     */
    private async handleChange(entity: any, tableName: string): Promise<void> {
        // Check if this is a junction table
        if (tableName === "group_participants") {
            return;
        }
        
        // @ts-ignore
        const junctionInfo = JUNCTION_TABLE_MAP[tableName];
        if (junctionInfo) {
            await this.handleJunctionTableChange(entity, junctionInfo);
            return;
        }
        
        // Handle regular entity changes
        const data = this.entityToPlain(entity);
        
        if (!data.id) {
            return;
        }
        
        // For Message entities, only process if they are system messages
        if (tableName === "messages") {
            const isSystemMessage = data.text && data.text.includes('$$system-message$$');
            
            if (!isSystemMessage) {
                return;
            }
        }

        try {
            setTimeout(async () => {
                let globalId = await this.adapter.mappingDb.getGlobalId(data.id);
                globalId = globalId ?? "";

                if (this.adapter.lockedIds.includes(globalId)) {
                    return;
                }

                // Check if this entity was recently created by a webhook
                if (this.adapter.lockedIds.includes(data.id)) {
                    return;
                }

                await this.adapter.handleChange({
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
                return;
            }

            const repository = AppDataSource.getRepository(junctionInfo.entity);
            const parentEntity = await repository.findOne({
                where: { id: parentId },
                relations: this.getRelationsForEntity(junctionInfo.entity),
            });

            if (!parentEntity) {
                return;
            }

            try {
                setTimeout(async () => {
                    let globalId = await this.adapter.mappingDb.getGlobalId(parentId);
                    globalId = globalId ?? "";

                    if (this.adapter.lockedIds.includes(globalId)) {
                        return;
                    }

                    const tableName = `${junctionInfo.entity.toLowerCase()}s`;
                    await this.adapter.handleChange({
                        data: this.entityToPlain(parentEntity),
                        tableName,
                    });
                }, 3_000);
            } catch (error) {
                console.error("Error in junction table timeout handler:", error);
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
            case "Poll":
                return ["group", "creator", "votes"];
            case "Vote":
                return ["poll", "user"];
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