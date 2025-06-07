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

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize database connection
AppDataSource.initialize()
    .then(() => {
        console.log("Database connection established");
    })
    .catch((error) => {
        console.error("Error connecting to database:", error);
        process.exit(1);
    });

// Controllers
const postController = new PostController();
const authController = new AuthController();
const commentController = new CommentController();
const messageController = new MessageController();
const userController = new UserController();

// Public routes (no auth required)
app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);
app.get("/api/chats/:chatId/events", messageController.getChatEvents);

// Protected routes (auth required)
app.use(authMiddleware); // Apply auth middleware to all routes below

// Blab routes
app.get("/api/blabs/feed", authGuard, postController.getFeed);
app.post("/api/blabs", authGuard, postController.createPost);
app.post("/api/blabs/:id/like", authGuard, postController.toggleLike);

// Reply routes
app.post("/api/replies", authGuard, commentController.createComment);
app.get(
    "/api/blabs/:blabId/replies",
    authGuard,
    commentController.getPostComments,
);
app.put("/api/replies/:id", authGuard, commentController.updateComment);
app.delete("/api/replies/:id", authGuard, commentController.deleteComment);

// Chat routes
app.post("/api/chats", authGuard, messageController.createChat);
app.get("/api/chats", authGuard, messageController.getUserChats);
app.get("/api/chats/:chatId", authGuard, messageController.getChat);

// Chat participant routes
app.post(
    "/api/chats/:chatId/users",
    authGuard,
    messageController.addParticipants,
);
app.delete(
    "/api/chats/:chatId/users/:userId",
    authGuard,
    messageController.removeParticipant,
);

// Chat message routes
app.post(
    "/api/chats/:chatId/texts",
    authGuard,
    messageController.createMessage,
);
app.get("/api/chats/:chatId/texts", authGuard, messageController.getMessages);
app.delete(
    "/api/chats/:chatId/texts/:textId",
    authGuard,
    messageController.deleteMessage,
);
app.post(
    "/api/chats/:chatId/texts/read",
    authGuard,
    messageController.markAsRead,
);
app.get(
    "/api/chats/:chatId/texts/unread",
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
