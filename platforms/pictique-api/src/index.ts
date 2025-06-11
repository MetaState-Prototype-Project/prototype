import "reflect-metadata";
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { AppDataSource } from "./database/data-source";
import { PostController } from "./controllers/PostController";
import path from "path";
import { AuthController } from "./controllers/AuthController";
import { CommentController } from "./controllers/CommentController";
import { MessageController } from "./controllers/MessageController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { UserController } from "./controllers/UserController";
import { PictiqueAdapter } from "./web3adapter";
import { UserService } from "./services/UserService";
import { PostService } from "./services/PostService";
import { CommentService } from "./services/CommentService";
import { ChatService } from "./services/ChatService";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 3000;

// Initialize services
const userService = new UserService();
const postService = new PostService();
const commentService = new CommentService();
const chatService = new ChatService();

// Initialize Web3 adapter
const adapter = new PictiqueAdapter(
    userService,
    postService,
    commentService,
    chatService
);

// Initialize database connection and adapter
AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");
        await adapter.initialize();
        console.log("Web3 adapter initialized");
    })
    .catch((error) => {
        console.error("Error during initialization:", error);
        process.exit(1);
    });

// Middleware
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Signature", "X-Webhook-Timestamp"],
        credentials: true,
    }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Controllers
const postController = new PostController();
const authController = new AuthController();
const commentController = new CommentController();
const messageController = new MessageController();
const userController = new UserController();

// Webhook route (no auth required)
app.post("/api/webhook", adapter.webhookHandler.handleWebhook);

// Public routes (no auth required)
app.get("/api/auth/offer", authController.getOffer);
app.get("/api/auth/offerb", authController.getOfferBlab);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);
app.get("/api/chats/:chatId/events", messageController.getChatEvents);

// Protected routes (auth required)
app.use(authMiddleware); // Apply auth middleware to all routes below

// Post routes
app.get("/api/posts/feed", authGuard, postController.getFeed);
app.post("/api/posts", authGuard, postController.createPost);
app.post("/api/posts/:id/like", authGuard, postController.toggleLike);

// Comment routes
app.post("/api/comments", authGuard, commentController.createComment);
app.get(
    "/api/posts/:postId/comments",
    authGuard,
    commentController.getPostComments,
);
app.put("/api/comments/:id", authGuard, commentController.updateComment);
app.delete("/api/comments/:id", authGuard, commentController.deleteComment);

// Chat routes
app.post("/api/chats", authGuard, messageController.createChat);
app.get("/api/chats", authGuard, messageController.getUserChats);
app.get("/api/chats/:chatId", authGuard, messageController.getChat);

// Chat participant routes
app.post(
    "/api/chats/:chatId/participants",
    authGuard,
    messageController.addParticipants,
);
app.delete(
    "/api/chats/:chatId/participants/:userId",
    authGuard,
    messageController.removeParticipant,
);

app.post(
    "/api/chats/:chatId/messages",
    authGuard,
    messageController.createMessage,
);
app.get(
    "/api/chats/:chatId/messages",
    authGuard,
    messageController.getMessages,
);
app.delete(
    "/api/chats/:chatId/messages/:messageId",
    authGuard,
    messageController.deleteMessage,
);
app.post(
    "/api/chats/:chatId/messages/read",
    authGuard,
    messageController.markAsRead,
);
app.get(
    "/api/chats/:chatId/messages/unread",
    authGuard,
    messageController.getUnreadCount,
);

// User routes
app.get("/api/users", userController.currentUser);
app.get("/api/users/search", userController.search);
app.post("/api/users/:id/follow", authGuard, userController.follow);
app.get("/api/users/:id", authGuard, userController.getProfileById);
app.patch("/api/users", authGuard, userController.updateProfile);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
