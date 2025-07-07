import { Request, Response } from "express";
import { TransformService } from "../services/TransformService";
import { web3AdapterConfig } from "../config";
import { EntityType, WebhookPayload, TransformContext } from "../types";
import { AppDataSource } from "../../database/data-source";
import { User } from "../../database/entities/User";
import { Post } from "../../database/entities/Post";
import { Comment } from "../../database/entities/Comment";
import { Chat } from "../../database/entities/Chat";
import { Message } from "../../database/entities/Message";
import { MessageReadStatus } from "../../database/entities/MessageReadStatus";
import { In } from "typeorm";

export class WebhookController {
    private userRepository = AppDataSource.getRepository(User);
    private postRepository = AppDataSource.getRepository(Post);
    private commentRepository = AppDataSource.getRepository(Comment);
    private chatRepository = AppDataSource.getRepository(Chat);
    private messageRepository = AppDataSource.getRepository(Message);
    private messageReadStatusRepository = AppDataSource.getRepository(MessageReadStatus);

    async handleWebhook(req: Request, res: Response) {
        const payload = req.body as WebhookPayload;
        console.log("Received webhook payload:", payload);

        // For now, we're not verifying signatures
        // TODO: Implement signature verification

        try {
            const entityType = this.getEntityTypeFromGlobal(payload.entityType);
            if (!entityType) {
                throw new Error(`Unsupported global ontology type: ${payload.entityType}`);
            }

            const transformContext: TransformContext = {
                platform: "blabsy",
                entityType,
                internalId: payload.metaEnvelopeId
            };

            const platformData = TransformService.getInstance().fromGlobalOntology(
                entityType,
                payload.payload,
                transformContext
            );

            switch (payload.operation) {
                case "create":
                    await this.handleCreate(entityType, platformData);
                    break;
                case "update":
                    await this.handleUpdate(entityType, platformData);
                    break;
                case "delete":
                    await this.handleDelete(entityType, platformData);
                    break;
                default:
                    throw new Error(`Unsupported operation: ${payload.operation}`);
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error("Error handling webhook:", error);
            res.status(500).json({ error: (error as Error).message });
        }
    }

    private getEntityTypeFromGlobal(globalType: string): EntityType | null {
        const mapping = Object.entries(web3AdapterConfig.entityMappings).find(
            ([_, value]) => value === globalType
        );
        return mapping ? (mapping[0] as EntityType) : null;
    }

    private async handleCreate(entityType: EntityType, data: any) {
        switch (entityType) {
            case "User": {
                const user = this.userRepository.create({
                    ename: data.ename,
                    handle: data.username,
                    name: data.displayName,
                    description: data.bio,
                    avatarUrl: data.avatarUrl
                });
                await this.userRepository.save(user);
                break;
            }
            case "Post": {
                const author = await this.userRepository.findOneBy({ ename: data.authorEname });
                if (!author) throw new Error(`Author not found: ${data.authorEname}`);

                const post = this.postRepository.create({
                    text: data.content,
                    images: data.images,
                    hashtags: data.hashtags,
                    author
                });
                await this.postRepository.save(post);
                break;
            }
            case "Comment": {
                const author = await this.userRepository.findOneBy({ ename: data.authorEname });
                if (!author) throw new Error(`Author not found: ${data.authorEname}`);

                // Find the parent post by its meta envelope ID
                const parentPost = await this.postRepository.findOne({
                    where: { id: data.parentId },
                    relations: ["author"]
                });
                if (!parentPost) throw new Error(`Parent post not found: ${data.parentId}`);

                const comment = this.commentRepository.create({
                    text: data.content,
                    author,
                    post: parentPost
                });
                await this.commentRepository.save(comment);
                break;
            }
            case "Chat": {
                const participants = await this.userRepository.findBy({
                    ename: In(data.participants)
                });
                if (participants.length === 0) {
                    throw new Error("No participants found");
                }

                const chat = this.chatRepository.create({
                    name: data.name,
                    participants
                });
                await this.chatRepository.save(chat);
                break;
            }
            case "Message": {
                const sender = await this.userRepository.findOneBy({ ename: data.authorEname });
                if (!sender) throw new Error(`Sender not found: ${data.authorEname}`);

                const chat = await this.chatRepository.findOneBy({ id: data.chatId });
                if (!chat) throw new Error(`Chat not found: ${data.chatId}`);

                const message = this.messageRepository.create({
                    text: data.content,
                    sender,
                    chat
                });
                await this.messageRepository.save(message);

                // Create read statuses for all chat participants except the sender
                const readStatuses = chat.participants
                    .filter(p => p.ename !== data.authorEname)
                    .map(participant =>
                        this.messageReadStatusRepository.create({
                            message,
                            user: participant,
                            isRead: false
                        })
                    );
                await this.messageReadStatusRepository.save(readStatuses);
                break;
            }
            case "MessageReadStatus": {
                const message = await this.messageRepository.findOneBy({ id: data.messageId });
                if (!message) throw new Error(`Message not found: ${data.messageId}`);

                const user = await this.userRepository.findOneBy({ ename: data.userEname });
                if (!user) throw new Error(`User not found: ${data.userEname}`);

                const readStatus = this.messageReadStatusRepository.create({
                    message,
                    user,
                    isRead: data.isRead
                });
                await this.messageReadStatusRepository.save(readStatus);
                break;
            }
        }
    }

    private async handleUpdate(entityType: EntityType, data: any) {
        switch (entityType) {
            case "User": {
                const user = await this.userRepository.findOneBy({ ename: data.ename });
                if (!user) throw new Error(`User not found: ${data.ename}`);

                Object.assign(user, {
                    handle: data.username,
                    name: data.displayName,
                    description: data.bio,
                    avatarUrl: data.avatarUrl
                });
                await this.userRepository.save(user);
                break;
            }
            case "Post": {
                const post = await this.postRepository.findOneBy({ id: data.id });
                if (!post) throw new Error(`Post not found: ${data.id}`);

                Object.assign(post, {
                    text: data.content,
                    images: data.images,
                    hashtags: data.hashtags
                });
                await this.postRepository.save(post);
                break;
            }
            case "Comment": {
                const comment = await this.commentRepository.findOneBy({ id: data.id });
                if (!comment) throw new Error(`Comment not found: ${data.id}`);

                Object.assign(comment, {
                    text: data.content
                });
                await this.commentRepository.save(comment);
                break;
            }
            case "Chat": {
                const chat = await this.chatRepository.findOneBy({ id: data.id });
                if (!chat) throw new Error(`Chat not found: ${data.id}`);

                const participants = await this.userRepository.findBy({
                    ename: In(data.participants)
                });
                if (participants.length === 0) {
                    throw new Error("No participants found");
                }

                Object.assign(chat, {
                    name: data.name,
                    participants
                });
                await this.chatRepository.save(chat);
                break;
            }
            case "Message": {
                const message = await this.messageRepository.findOneBy({ id: data.id });
                if (!message) throw new Error(`Message not found: ${data.id}`);

                Object.assign(message, {
                    text: data.content
                });
                await this.messageRepository.save(message);
                break;
            }
            case "MessageReadStatus": {
                const readStatus = await this.messageReadStatusRepository.findOneBy({ id: data.id });
                if (!readStatus) throw new Error(`Read status not found: ${data.id}`);

                Object.assign(readStatus, {
                    isRead: data.isRead
                });
                await this.messageReadStatusRepository.save(readStatus);
                break;
            }
        }
    }

    private async handleDelete(entityType: EntityType, data: any) {
        switch (entityType) {
            case "User": {
                const user = await this.userRepository.findOneBy({ ename: data.ename });
                if (!user) throw new Error(`User not found: ${data.ename}`);
                await this.userRepository.softDelete(user.id);
                break;
            }
            case "Post": {
                const post = await this.postRepository.findOneBy({ id: data.id });
                if (!post) throw new Error(`Post not found: ${data.id}`);
                await this.postRepository.softDelete(post.id);
                break;
            }
            case "Comment": {
                const comment = await this.commentRepository.findOneBy({ id: data.id });
                if (!comment) throw new Error(`Comment not found: ${data.id}`);
                await this.commentRepository.softDelete(comment.id);
                break;
            }
            case "Chat": {
                const chat = await this.chatRepository.findOneBy({ id: data.id });
                if (!chat) throw new Error(`Chat not found: ${data.id}`);
                await this.chatRepository.softDelete(chat.id);
                break;
            }
            case "Message": {
                const message = await this.messageRepository.findOneBy({ id: data.id });
                if (!message) throw new Error(`Message not found: ${data.id}`);
                await this.messageRepository.softDelete(message.id);
                break;
            }
            case "MessageReadStatus": {
                const readStatus = await this.messageReadStatusRepository.findOneBy({ id: data.id });
                if (!readStatus) throw new Error(`Read status not found: ${data.id}`);
                await this.messageReadStatusRepository.softDelete(readStatus.id);
                break;
            }
        }
    }
} 