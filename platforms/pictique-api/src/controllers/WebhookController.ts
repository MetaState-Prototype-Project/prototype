import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { UserService } from "../services/UserService";
import { ChatService } from "../services/ChatService";
import { PostService } from "../services/PostService";
import { CommentService } from "../services/CommentService";

export class WebhookController {
    userService: UserService;
    chatService: ChatService;
    postsService: PostService;
    commentService: CommentService;

    constructor() {
        this.userService = new UserService();
        this.chatService = new ChatService();
        this.postsService = new PostService();
        this.commentService = new CommentService();
    }

    handleWebhook = async (req: Request, res: Response) => {
        console.log(req.body);
    };
}
