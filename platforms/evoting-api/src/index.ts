import "reflect-metadata";
import path from "node:path";
import { toNodeHandler } from "better-auth/node";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { auth } from "./auth";
// import { AuthController } from "./controllers/AuthController";
// import { CommentController } from "./controllers/CommentController";
// import { MessageController } from "./controllers/MessageController";
// import { PostController } from "./controllers/PostController";
// import { UserController } from "./controllers/UserController";
// import { WebhookController } from "./controllers/WebhookController";
import { AppDataSource } from "./database/data-source";
// import { authGuard, authMiddleware } from "./middleware/auth";
// import { adapter } from "./web3adapter/watchers/subscriber";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 4000;

// Initialize database connection and adapter
AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");
        // console.log("Web3 adapter initialized");
    })
    .catch((error: unknown) => {
        console.error("Error during initialization:", error);
        process.exit(1);
    });

// Middleware
app.use(
    cors({
        origin: [process.env.EVOTING_CLIENT_URL || "http://localhost:3000"],
        methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Webhook-Signature",
            "X-Webhook-Timestamp",
        ],
        credentials: true,
    }),
);
app.all("/api/auth/*", toNodeHandler(auth));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// // Controllers
// const postController = new PostController();
// const authController = new AuthController();
// const commentController = new CommentController();
// const messageController = new MessageController();
// const userController = new UserController();
// const webhookController = new WebhookController(adapter);

// // Webhook route (no auth required)
// // app.post("/api/webhook", adapter.webhookHandler.handleWebhook);

// // Public routes (no auth required)
// app.get("/api/auth/offer", authController.getOffer);
// app.post("/api/auth", authController.login);
// app.get("/api/auth/sessions/:id", authController.sseStream);
// app.get("/api/chats/:chatId/events", messageController.getChatEvents);
// app.post("/api/webhook", webhookController.handleWebhook);

// // Protected routes (auth required)
// app.use(authMiddleware); // Apply auth middleware to all routes below

// // Post routes
// app.get("/api/posts/feed", authGuard, postController.getFeed);
// app.post("/api/posts", authGuard, postController.createPost);
// app.post("/api/posts/:id/like", authGuard, postController.toggleLike);

// // Comment routes
// app.post("/api/comments", authGuard, commentController.createComment);
// app.get(
//     "/api/posts/:postId/comments",
//     authGuard,
//     commentController.getPostComments,
// );
// app.put("/api/comments/:id", authGuard, commentController.updateComment);
// app.delete("/api/comments/:id", authGuard, commentController.deleteComment);

// // Chat routes
// app.post("/api/chats", authGuard, messageController.createChat);
// app.get("/api/chats", authGuard, messageController.getUserChats);
// app.get("/api/chats/:chatId", authGuard, messageController.getChat);

// // Chat participant routes
// app.post(
//     "/api/chats/:chatId/participants",
//     authGuard,
//     messageController.addParticipants,
// );
// app.delete(
//     "/api/chats/:chatId/participants/:userId",
//     authGuard,
//     messageController.removeParticipant,
// );

// app.post(
//     "/api/chats/:chatId/messages",
//     authGuard,
//     messageController.createMessage,
// );
// app.get(
//     "/api/chats/:chatId/messages",
//     authGuard,
//     messageController.getMessages,
// );
// app.delete(
//     "/api/chats/:chatId/messages/:messageId",
//     authGuard,
//     messageController.deleteMessage,
// );
// app.post(
//     "/api/chats/:chatId/messages/read",
//     authGuard,
//     messageController.markAsRead,
// );
// app.get(
//     "/api/chats/:chatId/messages/unread",
//     authGuard,
//     messageController.getUnreadCount,
// );

// // User routes
// app.get("/api/users", userController.currentUser);
// app.get("/api/users/search", userController.search);
// app.post("/api/users/:id/follow", authGuard, userController.follow);
// app.get("/api/users/:id", authGuard, userController.getProfileById);
// app.patch("/api/users", authGuard, userController.updateProfile);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
