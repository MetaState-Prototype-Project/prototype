import { WebhookHandler } from "./webhookHandler";
import { UserService } from "../services/UserService";
import { PostService } from "../services/PostService";
import { CommentService } from "../services/CommentService";
import { TypeORMIdMappingStore } from "./idMappingStore";
import { ChatService } from "services/ChatService";
import { AppDataSource } from "../database/data-source";

export class PictiqueAdapter {
    webhookHandler: WebhookHandler;
    private readonly idMappingStore: TypeORMIdMappingStore;

    constructor(
        userService: UserService,
        postService: PostService,
        commentService: CommentService,
        chatsService: ChatService, 
    ) {
        this.idMappingStore = new TypeORMIdMappingStore();
        this.webhookHandler = new WebhookHandler(
            userService,
            postService,
            commentService,
            chatsService,
            this.idMappingStore
        );
    }

    async initialize(): Promise<void> {
        // Wait for database connection
        if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
        }
    }
} 