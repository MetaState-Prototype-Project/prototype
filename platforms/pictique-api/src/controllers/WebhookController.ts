import { Request, Response } from "express";
import { UserService } from "../services/UserService";
import { ChatService } from "../services/ChatService";
import { PostService } from "../services/PostService";
import { CommentService } from "../services/CommentService";
import { Web3Adapter } from "../../../../infrastructure/web3-adapter/src";
import { User } from "database/entities/User";
import { Chat } from "database/entities/Chat";
import { MessageService } from "../services/MessageService";
import { Post } from "database/entities/Post";
import axios from "axios";

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
        try {
            if (process.env.ANCHR_URL) {
                axios.post(
                    new URL("pictique", process.env.ANCHR_URL).toString(),
                    req.body
                );
            }
            const schemaId = req.body.schemaId;
            const globalId = req.body.id;
            const mapping = Object.values(this.adapter.mapping).find(
                (m) => m.schemaId === schemaId
            );
            this.adapter.addToLockedIds(globalId);

            if (!mapping) throw new Error();
            const local = await this.adapter.fromGlobal({
                data: req.body.data,
                mapping,
            });

            mapping.tableName =
                mapping.tableName === "comments" ? "posts" : mapping.tableName;
            let localId = await this.adapter.mappingDb.getLocalId(globalId);

            if (mapping.tableName === "users") {
                if (localId) {
                    const user = await this.userService.findById(localId);
                    for (const key of Object.keys(local.data)) {
                        // @ts-ignore
                        user[key] = local.data[key];
                    }
                    if (!user) throw new Error();
                    user.name = req.body.data.displayName;
                    await this.userService.userRepository.save(user);
                    await this.adapter.mappingDb.storeMapping({
                        localId: user.id,
                        globalId: req.body.id,
                    });
                    this.adapter.addToLockedIds(user.id);
                    this.adapter.addToLockedIds(globalId);
                } else {
                    const { user } = await this.userService.findOrCreateUser(
                        req.body.w3id
                    );
                    for (const key of Object.keys(local.data)) {
                        // @ts-ignore
                        user[key] = local.data[key];
                    }
                    user.name = req.body.data.displayName;
                    await this.userService.userRepository.save(user);
                    await this.adapter.mappingDb.storeMapping({
                        localId: user.id,
                        globalId: req.body.id,
                    });
                    this.adapter.addToLockedIds(user.id);
                    this.adapter.addToLockedIds(globalId);
                }
            } else if (mapping.tableName === "posts") {
                let author: User | null = null;
                if (local.data.author) {
                    const authorId = local.data.author
                        // @ts-ignore
                        .split("(")[1]
                        .split(")")[0];
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
                        const comment =
                            await this.commentService.getCommentById(localId);
                        if (!comment) return;
                        comment.text = local.data.text as string;
                        comment.likedBy = likedBy as User[];
                        comment.author = author as User;
                        comment.post = parent as Post;
                        await this.commentService.commentRepository.save(
                            comment
                        );
                    } else {
                        const comment = await this.commentService.createComment(
                            parent?.id as string,
                            author?.id as string,
                            local.data.text as string
                        );
                        localId = comment.id;
                        await this.adapter.mappingDb.storeMapping({
                            localId,
                            globalId,
                        });
                    }
                    this.adapter.addToLockedIds(localId);
                } else {
                    let likedBy: User[] = [];
                    if (
                        local.data.likedBy &&
                        Array.isArray(local.data.likedBy)
                    ) {
                        const likedByPromises = local.data.likedBy.map(
                            async (ref: string) => {
                                if (ref && typeof ref === "string") {
                                    const userId = ref
                                        .split("(")[1]
                                        .split(")")[0];
                                    return await this.userService.findById(
                                        userId
                                    );
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
                        await this.adapter.mappingDb.storeMapping({
                            localId: post.id,
                            globalId,
                        });

                        // Verify the mapping was stored
                        const verifyLocalId =
                            await this.adapter.mappingDb.getLocalId(globalId);
                        console.log("Verified mapping:", {
                            expected: post.id,
                            actual: verifyLocalId,
                        });
                    }
                }
            } else if (mapping.tableName === "chats") {
                let participants: User[] = [];
                if (
                    local.data.participants &&
                    Array.isArray(local.data.participants)
                ) {
                    console.log(local);
                    const participantPromises = local.data.participants.map(
                        async (ref: string) => {
                            if (ref && typeof ref === "string") {
                                const userId = ref.split("(")[1].split(")")[0];
                                return await this.userService.findById(userId);
                            }
                            return null;
                        }
                    );
                    participants = (
                        await Promise.all(participantPromises)
                    ).filter((user): user is User => user !== null);
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
                    await this.adapter.mappingDb.storeMapping({
                        localId: chat.id,
                        globalId: req.body.id,
                    });
                }
            } else if (mapping.tableName === "messages") {
                console.log("messages");
                console.log(local.data);
                let sender: User | null = null;
                if (
                    local.data.sender &&
                    typeof local.data.sender === "string"
                ) {
                    const senderId = local.data.sender
                        .split("(")[1]
                        .split(")")[0];
                    sender = await this.userService.findById(senderId);
                }

                let chat: Chat | null = null;
                if (local.data.chat && typeof local.data.chat === "string") {
                    const chatId = local.data.chat.split("(")[1].split(")")[0];
                    chat = await this.chatService.findById(chatId);
                }

                if (!sender || !chat) {
                    console.log(local.data);
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
                    const message = await this.chatService.sendMessage(
                        chat.id,
                        sender.id,
                        local.data.text as string
                    );

                    this.adapter.addToLockedIds(message.id);
                    await this.adapter.mappingDb.storeMapping({
                        localId: message.id,
                        globalId: req.body.id,
                    });
                }
            }
            res.status(200).send();
        } catch (e) {
            console.error(e);
        }
    };
}
