import { EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent, RemoveEvent, DataSource } from "typeorm";
import { User } from "../../database/entities/User";
import { Post } from "../../database/entities/Post";
import { Comment } from "../../database/entities/Comment";
import { Chat } from "../../database/entities/Chat";
import { Message } from "../../database/entities/Message";
import { MessageReadStatus } from "../../database/entities/MessageReadStatus";
import { web3AdapterConfig } from "../config";
import { TransformService } from "../services/TransformService";
import { eVaultService } from "../services/eVaultService";
import { EntityType } from "../types";
import axios from "axios";

@EventSubscriber()
export class EntitySubscriber implements EntitySubscriberInterface {
    constructor(private dataSource: DataSource) {
        this.dataSource.subscribers.push(this as EntitySubscriberInterface);
    }

    listenTo(): Function {
        return function() {
            return [User, Post, Comment, Chat, Message, MessageReadStatus];
        };
    }

    async afterInsert(event: InsertEvent<any>): Promise<void> {
        if (!event.entity) return;

        try {
            const entityType = this.determineEntityType(event.entity);
            const ownerEname = this.determineOwnerEname(event.entity);
            const transformService = TransformService.getInstance();

            // Transform to global ontology
            const globalEntity = transformService.toGlobalOntology(
                entityType,
                event.entity,
                {
                    platform: "pictique",
                    entityType,
                    internalId: event.entity.id.toString()
                }
            );

            // Store in eVault
            const result = await eVaultService.storeMetaEnvelope(
                ownerEname,
                web3AdapterConfig.entityMappings[entityType],
                globalEntity
            );

            // Send webhook to Blabsy
            await axios.post(web3AdapterConfig.webhook.receiveUrl, {
                operation: "create",
                entityType,
                data: globalEntity,
                metaEnvelopeId: result.metaEnvelope.id
            }, {
                headers: {
                    "X-Webhook-Secret": web3AdapterConfig.webhook.secret
                }
            });
        } catch (error) {
            console.error("Error in afterInsert:", error);
        }
    }

    async afterUpdate(event: UpdateEvent<any>): Promise<void> {
        if (!event.entity) return;

        try {
            const entityType = this.determineEntityType(event.entity);
            const ownerEname = this.determineOwnerEname(event.entity);
            const transformService = TransformService.getInstance();

            // Transform to global ontology
            const globalEntity = transformService.toGlobalOntology(
                entityType,
                event.entity,
                {
                    platform: "pictique",
                    entityType,
                    internalId: event.entity.id.toString()
                }
            );

            // Store in eVault
            const result = await eVaultService.storeMetaEnvelope(
                ownerEname,
                web3AdapterConfig.entityMappings[entityType],
                globalEntity
            );

            // Send webhook to Blabsy
            await axios.post(web3AdapterConfig.webhook.receiveUrl, {
                operation: "update",
                entityType,
                data: globalEntity,
                metaEnvelopeId: result.metaEnvelope.id
            }, {
                headers: {
                    "X-Webhook-Secret": web3AdapterConfig.webhook.secret
                }
            });
        } catch (error) {
            console.error("Error in afterUpdate:", error);
        }
    }

    async afterRemove(event: RemoveEvent<any>): Promise<void> {
        if (!event.entity) return;

        try {
            const entityType = this.determineEntityType(event.entity);
            const ownerEname = this.determineOwnerEname(event.entity);

            // Send webhook to Blabsy
            await axios.post(web3AdapterConfig.webhook.receiveUrl, {
                operation: "delete",
                entityType,
                data: {
                    id: event.entity.id,
                    ownerEname
                }
            }, {
                headers: {
                    "X-Webhook-Secret": web3AdapterConfig.webhook.secret
                }
            });
        } catch (error) {
            console.error("Error in afterRemove:", error);
        }
    }

    private determineEntityType(entity: any): EntityType {
        if (entity instanceof User) return "User";
        if (entity instanceof Post) return "Post";
        if (entity instanceof Comment) return "Comment";
        if (entity instanceof Chat) return "Chat";
        if (entity instanceof Message) return "Message";
        if (entity instanceof MessageReadStatus) return "MessageReadStatus";
        throw new Error("Unknown entity type");
    }

    private determineOwnerEname(entity: any): string {
        if (entity instanceof User) return entity.ename;
        if (entity instanceof Post) return entity.author.ename;
        if (entity instanceof Comment) return entity.author.ename;
        if (entity instanceof Chat) return entity.participants[0].ename;
        if (entity instanceof Message) return entity.sender.ename;
        if (entity instanceof MessageReadStatus) return entity.user.ename;
        throw new Error("Unknown entity type for owner determination");
    }
} 