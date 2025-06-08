import { web3AdapterConfig } from "../config";
import { EntityType, GlobalOntologyType, TransformContext } from "../types";

export class TransformService {
    private static instance: TransformService;
    private constructor() {}

    static getInstance(): TransformService {
        if (!TransformService.instance) {
            TransformService.instance = new TransformService();
        }
        return TransformService.instance;
    }

    toGlobalOntology(
        entityType: EntityType,
        platformData: any,
        context: TransformContext
    ): Record<string, any> {
        switch (entityType) {
            case "User":
                return this.transformUser(platformData);
            case "Post":
                return this.transformPost(platformData);
            case "Comment":
                return this.transformComment(platformData, context);
            case "Chat":
                return this.transformChat(platformData);
            case "Message":
                return this.transformMessage(platformData);
            case "MessageReadStatus":
                return this.transformMessageReadStatus(platformData);
            default:
                throw new Error(`Unsupported entity type: ${entityType}`);
        }
    }

    fromGlobalOntology(
        entityType: EntityType,
        globalData: any,
        context: TransformContext
    ): Record<string, any> {
        switch (entityType) {
            case "User":
                return this.transformUserFromGlobal(globalData);
            case "Post":
                return this.transformPostFromGlobal(globalData);
            case "Comment":
                return this.transformCommentFromGlobal(globalData);
            case "Chat":
                return this.transformChatFromGlobal(globalData);
            case "Message":
                return this.transformMessageFromGlobal(globalData);
            case "MessageReadStatus":
                return this.transformMessageReadStatusFromGlobal(globalData);
            default:
                throw new Error(`Unsupported entity type: ${entityType}`);
        }
    }

    private transformUser(user: any): Record<string, any> {
        return {
            id: user.id,
            username: user.handle,
            displayName: user.name,
            bio: user.description,
            avatarUrl: user.avatarUrl,
            followers: user.followers?.map((f: any) => f.id) || [],
            following: user.following?.map((f: any) => f.id) || [],
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
        };
    }

    private transformUserFromGlobal(global: any): Record<string, any> {
        return {
            id: global.id,
            handle: global.username,
            name: global.displayName,
            description: global.bio,
            avatarUrl: global.avatarUrl,
            createdAt: global.createdAt,
            updatedAt: global.updatedAt
        };
    }

    private transformPost(post: any): Record<string, any> {
        return {
            content: post.text,
            images: post.images || [],
            hashtags: post.hashtags || [],
            authorEname: post.author?.ename,
            likes: post.likedBy?.length || 0,
            replies: post.comments?.length || 0,
            isArchived: post.isArchived,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt
        };
    }

    private transformPostFromGlobal(global: any): Record<string, any> {
        return {
            id: global.id,
            text: global.content,
            createdAt: global.createdAt,
            updatedAt: global.updatedAt
        };
    }

    private transformComment(comment: any, context: TransformContext): Record<string, any> {
        console.log("Transforming comment with context:", context);
        const data: Record<string, any> = {
            content: comment.text,
            authorEname: comment.author?.ename,
            likes: comment.likedBy?.length || 0,
            isArchived: comment.isArchived,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt
        };
        if (context.parentMetaEnvelopeId) {
            data.parentId = context.parentMetaEnvelopeId;
        }
        console.log("Transformed comment data:", data);
        return data;
    }

    private transformCommentFromGlobal(global: any): Record<string, any> {
        return {
            id: global.id,
            text: global.content,
            createdAt: global.createdAt,
            updatedAt: global.updatedAt
        };
    }

    private transformChat(chat: any): Record<string, any> {
        return {
            id: chat.id,
            name: chat.name,
            participants: chat.participants?.map((p: any) => p.id) || [],
            messages: chat.messages?.map((m: any) => m.id) || [],
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            isArchived: chat.isArchived || false
        };
    }

    private transformChatFromGlobal(global: any): Record<string, any> {
        return {
            id: global.id,
            createdAt: global.createdAt,
            updatedAt: global.updatedAt
        };
    }

    private transformMessage(message: any): Record<string, any> {
        return {
            id: message.id,
            content: message.text,
            authorId: message.sender?.id,
            chatId: message.chat?.id,
            readStatuses: message.readStatuses?.map((status: any) => ({
                userId: status.user?.id,
                isRead: status.isRead,
                readAt: status.readAt
            })) || [],
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
            isArchived: message.isArchived || false
        };
    }

    private transformMessageFromGlobal(global: any): Record<string, any> {
        return {
            id: global.id,
            text: global.content,
            createdAt: global.createdAt,
            updatedAt: global.updatedAt,
            isArchived: global.isArchived
        };
    }

    private transformMessageReadStatus(status: any): Record<string, any> {
        return {
            id: status.id,
            messageId: status.message?.id,
            userId: status.user?.id,
            isRead: status.isRead,
            readAt: status.readAt,
            createdAt: status.createdAt,
            updatedAt: status.updatedAt
        };
    }

    private transformMessageReadStatusFromGlobal(global: any): Record<string, any> {
        return {
            id: global.id,
            readAt: global.readAt
        };
    }
} 