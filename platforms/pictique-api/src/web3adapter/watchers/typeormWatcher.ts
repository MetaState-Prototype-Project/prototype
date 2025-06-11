import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, UpdateEvent, RemoveEvent, Document } from "typeorm";
import { WebhookHandler } from "../webhookHandler";
import { PictiqueToGlobalTransformer } from "../transforms/toGlobal";
import { IDMappingStore } from "../types";

type EntityType = 'user' | 'socialMediaPost' | 'comment' | 'chat' | 'message' | 'bookmark' | 'userProfile';

@EventSubscriber()
export class TypeORMWatcher implements EntitySubscriberInterface {
    constructor(
        private dataSource: DataSource,
        private webhookHandler: WebhookHandler,
        private transformer: PictiqueToGlobalTransformer,
        private idMappingStore: IDMappingStore
    ) {
        this.dataSource.subscribers.push(this);
    }

    async afterInsert(event: InsertEvent<any>): Promise<void> {
        try {
            if (!event.entity) return;
            
            const entityType = this.detectEntityType(event.entity);
            if (!entityType) return;

            const envelope = await this.transformer.toGlobal(event.entity as Document);
            const metaEnvelopeId = await this.idMappingStore.storeMapping(
                event.entity.id,
                envelope.id,
                entityType
            );

            await this.webhookHandler.sendWebhook({
                type: entityType,
                action: 'created',
                data: envelope.data,
                w3id: envelope.w3id,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error handling insert event:', error);
        }
    }

    async afterUpdate(event: UpdateEvent<any>): Promise<void> {
        try {
            if (!event.entity) return;
            
            const entityType = this.detectEntityType(event.entity);
            if (!entityType) return;

            const envelope = await this.transformer.toGlobal(event.entity as Document);
            const metaEnvelopeId = await this.idMappingStore.getMetaEnvelopeId(
                event.entity.id,
                entityType
            );

            if (!metaEnvelopeId) {
                console.warn(`No meta envelope ID found for ${entityType} ${event.entity.id}`);
                return;
            }

            await this.webhookHandler.sendWebhook({
                type: entityType,
                action: 'updated',
                data: envelope.data,
                w3id: envelope.w3id,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error handling update event:', error);
        }
    }

    async afterRemove(event: RemoveEvent<any>): Promise<void> {
        try {
            if (!event.entity) return;
            
            const entityType = this.detectEntityType(event.entity);
            if (!entityType) return;

            const metaEnvelopeId = await this.idMappingStore.getMetaEnvelopeId(
                event.entity.id,
                entityType
            );

            if (!metaEnvelopeId) {
                console.warn(`No meta envelope ID found for ${entityType} ${event.entity.id}`);
                return;
            }

            await this.webhookHandler.sendWebhook({
                type: entityType,
                action: 'deleted',
                data: event.entity,
                w3id: event.entity.id,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error handling remove event:', error);
        }
    }

    private detectEntityType(entity: any): EntityType | null {
        // User detection
        if (entity.hasOwnProperty('username') && entity.hasOwnProperty('displayName')) {
            return 'user';
        }
        // SocialMediaPost detection
        if (entity.hasOwnProperty('content') && entity.hasOwnProperty('authorId') && entity.hasOwnProperty('mediaUrls')) {
            return 'socialMediaPost';
        }
        // Comment detection
        if (entity.hasOwnProperty('content') && entity.hasOwnProperty('postId') && entity.hasOwnProperty('authorId')) {
            return 'comment';
        }
        // Chat detection
        if (entity.hasOwnProperty('participants') && entity.hasOwnProperty('type')) {
            return 'chat';
        }
        // Message detection
        if (entity.hasOwnProperty('content') && entity.hasOwnProperty('chatId') && entity.hasOwnProperty('senderId')) {
            return 'message';
        }
       
        return null;
    }
} 