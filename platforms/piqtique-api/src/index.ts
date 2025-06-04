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
        methods: ["GET", "POST", "OPTIONS", "PATCH"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    }),
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Protected routes (auth required)
app.use(authMiddleware); // Apply auth middleware to all routes below

// Post routes
app.get("/api/posts/feed", authGuard, postController.getFeed);
app.post("/api/posts", authGuard, postController.createPost);

// Comment routes
app.post("/api/comments", authGuard, commentController.createComment);
app.get("/api/posts/:postId/comments", authGuard, commentController.getPostComments);
app.put("/api/comments/:id", authGuard, commentController.updateComment);
app.delete("/api/comments/:id", authGuard, commentController.deleteComment);

// Message routes
app.post("/api/messages", authGuard, messageController.sendMessage);
app.get("/api/conversations", authGuard, messageController.getConversations);
app.get("/api/conversations/:userId", authGuard, messageController.getConversation);
app.delete("/api/messages/:id", authGuard, messageController.deleteMessage);

// User routes
app.get("/api/users/search", userController.search);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
