import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { UserService } from "../services/UserService";
import { ChatService } from "../services/ChatService";
import { PostService } from "../services/PostService";
import { CommentService } from "../services/CommentService";
import { Web3Adapter } from "../../../../infrastructure/web3-adapter/src";
import { MappingDatabase } from "../../../../infrastructure/web3-adapter/src/db";
import { User } from "database/entities/User";
import { Chat } from "database/entities/Chat";
import { MessageService } from "../services/MessageService";
import { Post } from "database/entities/Post";

export class WebhookController {
    userService: UserService;
    chatService: ChatService;
    postsService: PostService;
    commentService: CommentService;
    adapter: Web3Adapter;
    messageService: MessageService;

    constructor(adapter: Web3Adapter) {
        this.userService = new UserService();
        this.chatService = new ChatService();
        this.postsService = new PostService();
        this.commentService = new CommentService();
        this.adapter = adapter;
        this.messageService = new MessageService();
    }

    handleWebhook = async (req: Request, res: Response) => {
        const schemaId = req.body.schemaId;
        const globalId = req.body.id;
        const mapping = Object.values(this.adapter.mapping).find(
            (m) => m.schemaId === schemaId
        );

        if (!mapping) throw new Error();
        const local = this.adapter.fromGlobal({ data: req.body, mapping });

        let localId = this.adapter.mappingDb.getLocalId({
            globalId,
            tableName: mapping.tableName,
        });

        if (mapping.tableName === "user") {
            const { user } = await this.userService.findOrCreateUser(
                req.body.w3id
            );
            for (const key of Object.keys(local.data)) {
                // @ts-ignore
                user[key] = local.data[key];
            }
            await this.userService.userRepository.save(user);
            this.adapter.mappingDb.storeMapping({
                localId: user.id,
                globalId: req.body.id,
                tableName: mapping.tableName,
            });
            this.adapter.addToLockedIds(user.id);
        } else if (mapping.tableName === "post") {
            let author: User | null = null;
            if (local.data.author) {
                // @ts-ignore
                const authorId = local.data.author.split("(")[1].split(")")[0];
                author = await this.userService.findById(authorId);
            }
            let likedBy: User[] = [];
            if (local.data.likedBy && Array.isArray(local.data.likedBy)) {
                const likedByPromises = local.data.likedBy.map(
                    async (ref: string) => {
                        if (ref && typeof ref === "string") {
                            const userId = ref.split("(")[1].split(")")[0];
                            return await this.userService.findById(userId);
                        }
                        return null;
                    }
                );
                likedBy = (await Promise.all(likedByPromises)).filter(
                    (user): user is User => user !== null
                );
            }

            if (local.data.parentPostId) {
                const parentId = (local.data.parentPostId as string)
                    .split("(")[1]
                    .split(")")[0];
                const parent = await this.postsService.findById(parentId);
                if (localId) {
                    const comment = await this.commentService.getCommentById(
                        localId
                    );
                    if (!comment) return;
                    comment.text = local.data.text as string;
                    comment.likedBy = likedBy as User[];
                    comment.author = author as User;
                    comment.post = parent as Post;
                    await this.commentService.commentRepository.save(comment);
                } else {
                    const comment = await this.commentService.createComment(
                        parent?.id as string,
                        author?.id as string,
                        local.data.text as string
                    );
                    localId = comment.id;
                    this.adapter.mappingDb.storeMapping({
                        localId,
                        globalId,
                        tableName: mapping.tableName,
                    });
                }
                this.adapter.addToLockedIds(localId);
            } else {
                let likedBy: User[] = [];
                if (local.data.likedBy && Array.isArray(local.data.likedBy)) {
                    const likedByPromises = local.data.likedBy.map(
                        async (ref: string) => {
                            if (ref && typeof ref === "string") {
                                const userId = ref.split("(")[1].split(")")[0];
                                return await this.userService.findById(userId);
                            }
                            return null;
                        }
                    );
                    likedBy = (await Promise.all(likedByPromises)).filter(
                        (user): user is User => user !== null
                    );
                }

                if (localId) {
                    const post = await this.postsService.findById(localId);
                    if (!post) return res.status(500).send();
                    for (const key of Object.keys(local.data)) {
                        // @ts-ignore
                        post[key] = local.data[key];
                    }
                    post.likedBy = likedBy;
                    // @ts-ignore
                    post.author = author ?? undefined;

                    this.adapter.addToLockedIds(localId);
                    await this.postsService.postRepository.save(post);
                } else {
                    console.log("Creating new post");
                    const post = await this.postsService.createPost(
                        author?.id as string,
                        // @ts-ignore
                        {
                            ...local.data,
                            likedBy,
                        }
                    );

                    this.adapter.addToLockedIds(post.id);
                    this.adapter.mappingDb.storeMapping({
                        localId: post.id,
                        globalId,
                        tableName: mapping.tableName,
                    });

                    // Verify the mapping was stored
                    const verifyLocalId = this.adapter.mappingDb.getLocalId({
                        globalId,
                        tableName: mapping.tableName,
                    });
                    console.log("Verified mapping:", {
                        expected: post.id,
                        actual: verifyLocalId,
                    });
                }
            }
        } else if (mapping.tableName === "chat") {
            let participants: User[] = [];
            if (
                local.data.participants &&
                Array.isArray(local.data.participants)
            ) {
                const participantPromises = local.data.participants.map(
                    async (ref: string) => {
                        if (ref && typeof ref === "string") {
                            const userId = ref.split("(")[1].split(")")[0];
                            return await this.userService.findById(userId);
                        }
                        return null;
                    }
                );
                participants = (await Promise.all(participantPromises)).filter(
                    (user): user is User => user !== null
                );
            }

            if (localId) {
                const chat = await this.chatService.findById(localId);
                if (!chat) return res.status(500).send();

                chat.name = local.data.name as string;
                chat.participants = participants;

                this.adapter.addToLockedIds(localId);
                await this.chatService.chatRepository.save(chat);
            } else {
                const chat = await this.chatService.createChat(
                    local.data.name as string,
                    participants.map((p) => p.id)
                );

                this.adapter.addToLockedIds(chat.id);
                this.adapter.mappingDb.storeMapping({
                    localId: chat.id,
                    globalId: req.body.id,
                    tableName: mapping.tableName,
                });
            }
        } else if (mapping.tableName === "message") {
            let sender: User | null = null;
            if (local.data.sender && typeof local.data.sender === "string") {
                const senderId = local.data.sender.split("(")[1].split(")")[0];
                sender = await this.userService.findById(senderId);
            }

            let chat: Chat | null = null;
            if (local.data.chat && typeof local.data.chat === "string") {
                const chatId = local.data.chat.split("(")[1].split(")")[0];
                chat = await this.chatService.findById(chatId);
            }

            if (!sender || !chat) {
                console.log("Missing sender or chat for message");
                return res.status(400).send();
            }

            if (localId) {
                console.log("Updating existing message");
                const message = await this.messageService.findById(localId);
                if (!message) return res.status(500).send();

                message.text = local.data.text as string;
                message.sender = sender;
                message.chat = chat;

                this.adapter.addToLockedIds(localId);
                await this.messageService.messageRepository.save(message);
            } else {
                console.log("Creating new message");
                const message = await this.messageService.createMessage(
                    sender.id,
                    chat.id,
                    local.data.text as string
                );

                this.adapter.addToLockedIds(message.id);
                this.adapter.mappingDb.storeMapping({
                    localId: message.id,
                    globalId: req.body.id,
                    tableName: mapping.tableName,
                });
            }
        }
        res.status(200).send();
    };
}
