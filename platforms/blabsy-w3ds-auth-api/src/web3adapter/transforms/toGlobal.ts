import { DocumentData, Timestamp } from "firebase-admin/firestore";
import { MetaEnvelope, DataTransformer } from "../types";
import { v4 as uuidv4 } from "uuid";
import { IDMappingStore } from "../types";

interface EntityType {
    type: "user" | "socialMediaPost" | "message" | "comment";
    w3id: string;
}

function transformFirestoreTimestamps(data: any): any {
    if (data === null || data === undefined) {
        return data;
    }

    if (data instanceof Timestamp) {
        return data.toDate().toISOString();
    }

    if (data._seconds !== undefined && data._nanoseconds !== undefined) {
        return new Date(data._seconds * 1000 + data._nanoseconds / 1000000).toISOString();
    }

    if (Array.isArray(data)) {
        return data.map(item => transformFirestoreTimestamps(item));
    }

    if (typeof data === 'object') {
        const transformed: any = {};
        for (const [key, value] of Object.entries(data)) {
            transformed[key] = transformFirestoreTimestamps(value);
        }
        return transformed;
    }

    return data;
}

export class BlabsyToGlobalTransformer
    implements DataTransformer<DocumentData>
{
    private readonly schemaIds: Record<EntityType["type"], string> = {
        user: "550e8400-e29b-41d4-a716-446655440000",
        socialMediaPost: "550e8400-e29b-41d4-a716-446655440001",
        message: "550e8400-e29b-41d4-a716-446655440002",
        comment: "550e8400-e29b-41d4-a716-446655440003",
    };

    constructor(private idMappingStore: IDMappingStore) {}

    private async resolveParentId(parentId: string, entityType: string): Promise<string | null> {
        if (!parentId) return null;
        return await this.idMappingStore.getMetaEnvelopeId(parentId, entityType);
    }

    async toGlobal(data: DocumentData): Promise<MetaEnvelope> {
        // Transform Firestore timestamps to ISO strings
        const transformedData = transformFirestoreTimestamps(data);

        const entityType = this.detectEntityType(transformedData);
        if (!entityType) {
            throw new Error("Could not detect entity type from data");
        }

        const schemaId = this.schemaIds[entityType.type];
        if (!schemaId) {
            throw new Error(`No schema ID found for entity type: ${entityType.type}`);
        }

        const acl = this.extractACL(transformedData);
        const transformed = await this.transformData(entityType, transformedData)
        return {
            id: uuidv4(),
            schemaId,
            data: transformed,
            acl,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            w3id: entityType.w3id,
        };
    }

    async fromGlobal(envelope: MetaEnvelope): Promise<DocumentData> {
        const entityType = this.getEntityTypeFromSchemaId(envelope.schemaId);
        if (!entityType) {
            throw new Error(`Unknown schema ID: ${envelope.schemaId}`);
        }

        switch (entityType.type) {
            case "user":
                return this.transformFromUser(envelope.data);
            case "socialMediaPost":
                return this.transformFromPost(envelope.data);
            case "message":
                return this.transformFromMessage(envelope.data);
            case "comment":
                return this.transformFromComment(envelope.data);
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

    private detectEntityType(data: DocumentData): EntityType | null {
        // Detect entity type based on data structure and extract w3id from creator
        if (
            Object.prototype.hasOwnProperty.call(data, "username") &&
            Object.prototype.hasOwnProperty.call(data, "name")
        ) {
            return { type: "user", w3id: data.id };
        }
        if (
            Object.prototype.hasOwnProperty.call(data, "text") &&
            Object.prototype.hasOwnProperty.call(data, "createdBy")
        ) {
            return { type: "socialMediaPost", w3id: data.createdBy };
        }
        if (
            Object.prototype.hasOwnProperty.call(data, "chatId") &&
            Object.prototype.hasOwnProperty.call(data, "senderId")
        ) {
            return { type: "message", w3id: data.senderId };
        }
        if (
            Object.prototype.hasOwnProperty.call(data, "postId") &&
            Object.prototype.hasOwnProperty.call(data, "authorId")
        ) {
            return { type: "comment", w3id: data.authorId };
        }
        return null;
    }

    private async transformData(
        entityType: EntityType,
        data: DocumentData
    ): Promise<Record<string, any>> {
        switch (entityType.type) {
            case "user":
                return this.transformUser(data);
            case "socialMediaPost":
                return this.transformSocialMediaPost(data);
            case "message":
                return this.transformMessage(data);
            case "comment":
                return this.transformComment(data);
            default:
                throw new Error(`Unsupported entity type: ${entityType.type}`);
        }
    }

    private async transformUser(data: DocumentData): Promise<Record<string, any>> {
        return {
            username: data.username,
            displayName: data.name,
            bio: data.bio || '',
            profileImageUrl: data.profileImageUrl || '',
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        };
    }

    private async transformSocialMediaPost(data: DocumentData): Promise<Record<string, any>> {
        const parentId = await this.resolveParentId(data.parentId, 'socialMediaPost');
        
        return {
            content: data.text,
            authorId: data.createdBy,
            parentId,
            likes: data.likes || 0,
            retweets: data.userRetweets || 0,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            images: data.images ? data.images.map((i: any) => i.src) : [],
            
        };
    }

    private async transformMessage(data: DocumentData): Promise<Record<string, any>> {
        const chatId = await this.resolveParentId(data.chatId, 'chat');
        
        return {
            content: data.content,
            senderId: data.senderId,
            chatId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        };
    }

    private async transformComment(data: DocumentData): Promise<Record<string, any>> {
        const postId = await this.resolveParentId(data.postId, 'socialMediaPost');
        
        return {
            content: data.content,
            authorId: data.authorId,
            postId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        };
    }

    private transformFromUser(data: Record<string, any>): DocumentData {
        return {
            id: data.id,
            username: data.username,
            displayName: data.displayName,
            bio: data.bio,
            avatarUrl: data.avatarUrl,
            bannerUrl: data.bannerUrl,
            website: data.website,
            location: data.location,
            isVerified: data.isVerified,
            isPrivate: data.isPrivate,
            followerCount: data.followerCount,
            followingCount: data.followingCount,
            postCount: data.postCount,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            isArchived: data.isArchived,
        };
    }

    private transformFromPost(data: Record<string, any>): DocumentData {
        return {
            id: data.id,
            authorId: data.authorId,
            content: data.content,
            mediaUrls: data.mediaUrls.map((i: any) => i.src),
            parentPostId: data.parentPostId,
            hashtags: data.hashtags,
            likeCount: data.likeCount,
            replyCount: data.replyCount,
            repostCount: data.repostCount,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            isArchived: data.isArchived,
            visibility: data.visibility,
        };
    }

    private transformFromMessage(data: Record<string, any>): DocumentData {
        return {
            id: data.id,
            chatId: data.chatId,
            senderId: data.senderId,
            content: data.content,
            mediaUrls: data.mediaUrls,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            isRead: data.isRead,
        };
    }

    private transformFromComment(data: Record<string, any>): DocumentData {
        return {
            id: data.id,
            postId: data.postId,
            authorId: data.authorId,
            content: data.content,
            mediaUrls: data.mediaUrls,
            likeCount: data.likeCount,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            isArchived: data.isArchived,
        };
    }

    private extractACL(data: DocumentData): string[] {
        const acl: string[] = [];

        // Add author to ACL
        if (data.authorId) {
            acl.push(data.authorId);
        }

        // Add mentioned users to ACL
        if (data.mentions && Array.isArray(data.mentions)) {
            acl.push(...data.mentions);
        }

        // Add chat participants to ACL for messages
        if (data.participants && Array.isArray(data.participants)) {
            acl.push(...data.participants);
        }

        return [...new Set(acl)]; // Remove duplicates
    }
}
