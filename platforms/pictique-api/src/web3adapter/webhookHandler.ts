import { Request, Response } from "express";
import { WebhookPayload } from "./types";
import { UserService } from "../services/UserService";
import { PostService } from "../services/PostService";
import { CommentService } from "../services/CommentService";
import { ChatService } from "../services/ChatService";
import { GlobalToPictiqueTransformer } from "./transforms/fromGlobal";
import { IDMappingStore, MetaEnvelope } from "./types";
import { AppDataSource } from "../database/data-source";
import { Post } from "../database/entities/Post";
import { Document } from "typeorm";
import axios from "axios";

export class WebhookHandler {
    private transformer: GlobalToPictiqueTransformer;
    private postRepository = AppDataSource.getRepository(Post);

    constructor(
        private readonly userService: UserService,
        private readonly postService: PostService,
        private readonly commentService: CommentService,
        private readonly chatService: ChatService,
        private readonly idMappingStore: IDMappingStore
    ) {
        this.transformer = new GlobalToPictiqueTransformer(idMappingStore);
        this.handleWebhook = this.handleWebhook.bind(this);
    }

    async handleWebhook(req: Request, res: Response): Promise<void> {
        try {
            const payload = req.body as WebhookPayload;
            console.log("payload", payload);
            // Transform the data using our transformer
            const transformedData = await this.transformer.fromGlobal({
                id: payload.id,
                schemaId: this.getSchemaIdForType(payload.type),
                data: payload.data,
                w3id: payload.w3id,
                acl: payload.acl || ["*"],
                createdAt: payload.createdAt,
                updatedAt: payload.updatedAt
            });

            console.log("transformedData", transformedData);
            // Handle based on entity type
            switch (payload.type) {
                case "user":
                    await this.handleUserEvent(transformedData);
                    break;
                case "socialMediaPost":
                    await this.handlePostEvent(transformedData);
                    break;
                case "comment":
                    await this.handleCommentEvent(transformedData);
                    break;
                case "chat":
                    await this.handleChatEvent(transformedData);
                    break;
                case "message":
                    await this.handleMessageEvent(transformedData);
                    break;
                default:
                    throw new Error(`Unsupported entity type: ${payload.type}`);
            }
            console.log("success")

            res.status(200).json({ success: true });
        } catch (error) {
            console.error("Webhook error:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }

    private async handleUserEvent(data: Document): Promise<void> {
        const id = await this.idMappingStore.getLocalId(data.id, "user");
        
        let user;
        if (id) {
            const existingUser = await this.userService.findById(id);
            if (!existingUser) return;
            
            user = await this.userService.updateProfile(id, {
                handle: data.ename,
                avatarUrl: data.avatarUrl,
                name: data.name
            });
        } else {
            user = await this.userService.findOrCreateUser(data.ename);
            await this.idMappingStore.storeMapping( user.user.id, data.id, "user");
        }
        console.log("user", user);
    }

    private async handlePostEvent(data: Document): Promise<void> {
        const id = await this.idMappingStore.getLocalId(data.id, "socialMediaPost");
        
        let post;
        if (id) {
            const existingPost = await this.postRepository.findOne({
                where: { id: id as string },
            });
            if (!existingPost) return;
            
            existingPost.text = data.text;
            existingPost.images = data.images || [];
            existingPost.likedBy = data.likedBy.map((user: { id: string }) => user.id);
            post = await this.postRepository.save(existingPost);
        } else {
            // Create new post
            post = await this.postService.createPost(data.author.id, {
                text: data.text,
                images: data.images || [],
                hashtags: data.hashtags || []
            });
            await this.idMappingStore.storeMapping(post.id, data.id, "socialMediaPost");
        }
        console.log("post", post);
    }

    private async handleCommentEvent(data: Document): Promise<void> {
        const id = await this.idMappingStore.getLocalId(data.id, "comment");
        
        let comment;
        if (id) {
            const existingComment = await this.commentService.getCommentById(id);
            if (!existingComment) return;
            
            comment = await this.commentService.updateComment(id, data.text);
        } else {
            comment = await this.commentService.createComment(data.author.id, data.post.id, data.text);
            await this.idMappingStore.storeMapping(comment.id, data.id, "comment");
        }
        console.log("comment", comment);
    }

    private async handleChatEvent(data: Document): Promise<void> {
        const id = await this.idMappingStore.getLocalId(data.id, "chat");
        
        let chat;
        if (id) {
            const existingChat = await this.chatService.getChatById(id);
            if (!existingChat) return;
            
            // Only update name if it's provided
            if (data.name) {
                chat = await this.chatService.updateChat(id, data.name);
            } else {
                chat = existingChat;
            }
        } else {
            chat = await this.chatService.createChat(data.name, data.participants.map((p: { id: string }) => p.id));
            await this.idMappingStore.storeMapping(chat.id, data.id, "chat");
        }
        console.log("chat", chat);
    }

    private async handleMessageEvent(data: Document): Promise<void> {
        const id = await this.idMappingStore.getLocalId(data.id, "message");
        
        let message;
        if (id) {
            // Since we don't have updateMessage, we'll just log that we received an update
            console.log("Received message update for ID:", id);
            return;
        } else {
            message = await this.chatService.sendMessage(data.chat.id, data.sender.id, data.text);
            await this.idMappingStore.storeMapping( message.id, data.id, "message");
        }
        console.log("message", message);
    }

    private getSchemaIdForType(type: string): string {
        const schemaIds: Record<string, string> = {
            user: "550e8400-e29b-41d4-a716-446655440000",
            socialMediaPost: "550e8400-e29b-41d4-a716-446655440001",
            comment: "550e8400-e29b-41d4-a716-446655440002",
            chat: "550e8400-e29b-41d4-a716-446655440003",
            message: "550e8400-e29b-41d4-a716-446655440004"
        };
        return schemaIds[type] || "";
    }

    async sendWebhook(payload: WebhookPayload): Promise<void> {
        const url = new URL("/api/webhook", process.env.PUBLIC_BLABSY_BASE_URL ?? "http://localhost:4444").toString()
        await axios.post(url, payload);
    }
}
