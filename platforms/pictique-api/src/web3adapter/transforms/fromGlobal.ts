import { Document } from "typeorm";
import { MetaEnvelope, DataTransformer } from "../types";
import { IDMappingStore } from "../types";

interface EntityType {
    type: "user" | "socialMediaPost" | "comment" | "chat" | "message";
    w3id: string;
}

export class GlobalToPictiqueTransformer implements DataTransformer<Document> {
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
        return await this.idMappingStore.getLocalId(parentId, entityType);
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

    // Required by DataTransformer interface but not used in this class
    async toGlobal(data: Document): Promise<MetaEnvelope> {
        throw new Error("toGlobal is not implemented in GlobalToPictiqueTransformer");
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
            ename: data.id,
            name: data.displayName,
            handle: data.username,
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
            author: { id: authorId },
            text: data.content,
            images: data.images,
            parentId,
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