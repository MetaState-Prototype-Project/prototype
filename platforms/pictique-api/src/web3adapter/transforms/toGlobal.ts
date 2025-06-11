import { Document } from "typeorm";
import { MetaEnvelope, DataTransformer } from "../types";
import { v4 as uuidv4 } from "uuid";
import { IDMappingStore } from "../types";

interface EntityType {
    type: "user" | "socialMediaPost" | "comment" | "chat" | "message";
    w3id: string;
}

export class PictiqueToGlobalTransformer implements DataTransformer<Document> {
    private readonly schemaIds: Record<EntityType["type"], string> = {
        user: "550e8400-e29b-41d4-a716-446655440000",
        socialMediaPost: "550e8400-e29b-41d4-a716-446655440001",
        comment: "550e8400-e29b-41d4-a716-446655440002",
        chat: "550e8400-e29b-41d4-a716-446655440003",
        message: "550e8400-e29b-41d4-a716-446655440004",
    };

    constructor(private idMappingStore: IDMappingStore) {}

    private async resolveParentId(parentId: string, entityType: string): Promise<string | null> {
        if (!parentId) return null;
        return await this.idMappingStore.getMetaEnvelopeId(parentId, entityType);
    }

    async toGlobal(data: Document): Promise<MetaEnvelope> {
        const entityType = this.detectEntityType(data);
        if (!entityType) {
            throw new Error("Could not detect entity type from data");
        }

        const schemaId = this.schemaIds[entityType.type];
        if (!schemaId) {
            throw new Error(`No schema ID found for entity type: ${entityType.type}`);
        }

        const transformedData = await this.transformData(entityType, data);
        const acl = this.extractACL(data);

        return {
            id: uuidv4(),
            schemaId,
            data: transformedData,
            acl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            w3id: entityType.w3id,
        };
    }

    private detectEntityType(data: Document): EntityType | null {
        if (data.hasOwnProperty('ename') && data.hasOwnProperty('handle')) {
            return { type: "user", w3id: data.id };
        }
        if (data.hasOwnProperty('text') && data.hasOwnProperty('author')) {
            return { type: "socialMediaPost", w3id: data.id };
        }
        if (data.hasOwnProperty('text') && data.hasOwnProperty('post')) {
            return { type: "comment", w3id: data.id };
        }
        if (data.hasOwnProperty('name') && data.hasOwnProperty('participants')) {
            return { type: "chat", w3id: data.id };
        }
        if (data.hasOwnProperty('text') && data.hasOwnProperty('chat')) {
            return { type: "message", w3id: data.id };
        }
        return null;
    }

    private async transformData(entityType: EntityType, data: Document): Promise<Record<string, any>> {
        switch (entityType.type) {
            case "user":
                return this.transformUser(data);
            case "socialMediaPost":
                return this.transformPost(data);
            case "comment":
                return this.transformComment(data);
            case "chat":
                return this.transformChat(data);
            case "message":
                return this.transformMessage(data);
            default:
                throw new Error(`Unsupported entity type: ${entityType.type}`);
        }
    }

    private async transformUser(data: Document): Promise<Record<string, any>> {
        return {
            id: await this.idMappingStore.getMetaEnvelopeId(data.id, 'user') || data.id,
            username: data.ename,
            displayName: data.name || data.ename,
            bio: data.description || null,
            avatarUrl: data.avatarUrl || null,
            bannerUrl: data.coverImageUrl || null,
            website: data.website || null,
            location: data.location || null,
            isVerified: data.isVerified || false,
            isPrivate: data.isPrivate || false,
            followerCount: data.followers?.length || 0,
            followingCount: data.following?.length || 0,
            postCount: data.totalPosts || 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isArchived: data.isArchived || false
        };
    }

    private async transformPost(data: Document): Promise<Record<string, any>> {
        const parentId = await this.resolveParentId(data.parentId, 'socialMediaPost');
        const authorId = await this.idMappingStore.getMetaEnvelopeId(data.author.id, 'user');
        
        return {
            id: await this.idMappingStore.getMetaEnvelopeId(data.id, 'socialMediaPost') || data.id,
            authorId: authorId || data.author.id,
            content: data.text,
            mediaUrls: data.images || [],
            parentPostId: parentId,
            hashtags: data.hashtags || [],
            likeCount: data.likedBy?.length || 0,
            replyCount: data.comments?.length || 0,
            repostCount: 0, // Not implemented in Pictique yet
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isArchived: data.isArchived || false,
            visibility: "public" // Default to public for now
        };
    }

    private async transformComment(data: Document): Promise<Record<string, any>> {
        const parentId = await this.resolveParentId(data.parentId, 'comment');
        const authorId = await this.idMappingStore.getMetaEnvelopeId(data.author.id, 'user');
        const postId = await this.idMappingStore.getMetaEnvelopeId(data.post.id, 'socialMediaPost');
        
        return {
            id: await this.idMappingStore.getMetaEnvelopeId(data.id, 'comment') || data.id,
            authorId: authorId || data.author.id,
            postId: postId || data.post.id,
            content: data.text,
            likeCount: data.likes || 0,
            parentCommentId: parentId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isArchived: data.isArchived || false
        };
    }

    private async transformChat(data: Document): Promise<Record<string, any>> {
        const lastMessage = data.messages?.[data.messages.length - 1];
        const lastMessageId = lastMessage ? await this.idMappingStore.getMetaEnvelopeId(lastMessage.id, 'message') : null;
        
        // Transform all participant IDs to meta envelope IDs
        const participantIds = await Promise.all(
            (data.participants || []).map(async (p: { id: string }) => 
                await this.idMappingStore.getMetaEnvelopeId(p.id, 'user') || p.id
            )
        );
        
        return {
            id: await this.idMappingStore.getMetaEnvelopeId(data.id, 'chat') || data.id,
            name: data.name || null,
            type: data.participants?.length > 2 ? "group" : "direct",
            participantIds,
            lastMessageId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isArchived: data.isArchived || false
        };
    }

    private async transformMessage(data: Document): Promise<Record<string, any>> {
        const senderId = await this.idMappingStore.getMetaEnvelopeId(data.sender.id, 'user');
        const chatId = await this.idMappingStore.getMetaEnvelopeId(data.chat.id, 'chat');
        
        // Transform all read status user IDs to meta envelope IDs
        const readBy = await Promise.all(
            (data.readStatuses || []).map(async (status: { user: { id: string } }) => 
                await this.idMappingStore.getMetaEnvelopeId(status.user.id, 'user') || status.user.id
            )
        );
        
        return {
            id: await this.idMappingStore.getMetaEnvelopeId(data.id, 'message') || data.id,
            chatId: chatId || data.chat.id,
            senderId: senderId || data.sender.id,
            content: data.text,
            type: "text", // Default to text for now
            mediaUrl: null, // Not implemented in Pictique yet
            readBy,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isArchived: data.isArchived || false
        };
    }

    private extractACL(data: Document): string[] {
        // Implement ACL extraction based on your requirements
        return ["*"];
    }

    async fromGlobal(envelope: MetaEnvelope): Promise<Document> {
        const entityType = this.getEntityTypeFromSchemaId(envelope.schemaId);
        if (!entityType) {
            throw new Error(`Unknown schema ID: ${envelope.schemaId}`);
        }

        switch (entityType.type) {
            case "user":
                return this.transformFromUser(envelope.data);
            case "socialMediaPost":
                return this.transformFromPost(envelope.data);
            case "comment":
                return this.transformFromComment(envelope.data);
            case "chat":
                return this.transformFromChat(envelope.data);
            case "message":
                return this.transformFromMessage(envelope.data);
            default:
                throw new Error(`Unsupported entity type: ${entityType.type}`);
        }
    }

    private getEntityTypeFromSchemaId(schemaId: string): EntityType | null {
        const entry = Object.entries(this.schemaIds).find(
            ([_, id]) => id === schemaId
        );
        return entry
            ? ({
                  type: entry[0] as EntityType["type"],
                  w3id: entry[1],
              } as EntityType)
            : null;
    }

    private async transformFromUser(data: Record<string, any>): Promise<Document> {
        const localId = await this.idMappingStore.getLocalId(data.id, 'user');
        return {
            id: localId || data.id,
            ename: data.username,
            name: data.displayName,
            description: data.bio,
            avatarUrl: data.avatarUrl,
            coverImageUrl: data.bannerUrl,
            website: data.website,
            location: data.location,
            isVerified: data.isVerified,
            isPrivate: data.isPrivate,
            followers: [],
            following: [],
            totalPosts: data.postCount,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isArchived: data.isArchived
        } as Document;
    }

    private async transformFromPost(data: Record<string, any>): Promise<Document> {
        const localId = await this.idMappingStore.getLocalId(data.id, 'socialMediaPost');
        const authorId = await this.idMappingStore.getLocalId(data.authorId, 'user');
        const parentId = data.parentPostId ? await this.idMappingStore.getLocalId(data.parentPostId, 'socialMediaPost') : null;
        
        return {
            id: localId || data.id,
            author: { id: authorId || data.authorId },
            text: data.content,
            images: data.mediaUrls,
            parentId,
            hashtags: data.hashtags,
            likedBy: [],
            comments: [],
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isArchived: data.isArchived
        } as Document;
    }

    private async transformFromComment(data: Record<string, any>): Promise<Document> {
        const localId = await this.idMappingStore.getLocalId(data.id, 'comment');
        const authorId = await this.idMappingStore.getLocalId(data.authorId, 'user');
        const postId = await this.idMappingStore.getLocalId(data.postId, 'socialMediaPost');
        const parentId = data.parentCommentId ? await this.idMappingStore.getLocalId(data.parentCommentId, 'comment') : null;
        
        return {
            id: localId || data.id,
            author: { id: authorId || data.authorId },
            post: { id: postId || data.postId },
            text: data.content,
            parentId,
            likes: data.likeCount,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isArchived: data.isArchived
        } as Document;
    }

    private async transformFromChat(data: Record<string, any>): Promise<Document> {
        const localId = await this.idMappingStore.getLocalId(data.id, 'chat');
        
        // Transform all participant IDs back to local IDs
        const participants = await Promise.all(
            (data.participantIds || []).map(async (id: string) => {
                const localId = await this.idMappingStore.getLocalId(id, 'user');
                return { id: localId || id };
            })
        );
        
        return {
            id: localId || data.id,
            name: data.name,
            participants,
            messages: [],
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isArchived: data.isArchived
        } as Document;
    }

    private async transformFromMessage(data: Record<string, any>): Promise<Document> {
        const localId = await this.idMappingStore.getLocalId(data.id, 'message');
        const senderId = await this.idMappingStore.getLocalId(data.senderId, 'user');
        const chatId = await this.idMappingStore.getLocalId(data.chatId, 'chat');
        
        // Transform all read status user IDs back to local IDs
        const readStatuses = await Promise.all(
            (data.readBy || []).map(async (userId: string) => {
                const localId = await this.idMappingStore.getLocalId(userId, 'user');
                return { user: { id: localId || userId } };
            })
        );
        
        return {
            id: localId || data.id,
            sender: { id: senderId || data.senderId },
            chat: { id: chatId || data.chatId },
            text: data.content,
            readStatuses,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isArchived: data.isArchived
        } as Document;
    }
} 