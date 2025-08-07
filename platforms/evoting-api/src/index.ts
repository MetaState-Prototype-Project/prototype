import "reflect-metadata";
import path from "node:path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { AppDataSource } from "./database/data-source";
import { AuthController } from "./controllers/AuthController";
import { UserController } from "./controllers/UserController";
import { WebhookController } from "./controllers/WebhookController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { adapter } from "./web3adapter/watchers/subscriber";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 4000;

// Initialize database connection and adapter
AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");
        console.log("Web3 adapter initialized");
    })
    .catch((error: unknown) => {
        console.error("Error during initialization:", error);
        process.exit(1);
    });

// Middleware
app.use(
    cors({
        origin: [process.env.EVOTING_CLIENT_URL || "http://localhost:3000"],
        methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE", "PUT"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Webhook-Signature",
            "X-Webhook-Timestamp",
        ],
        credentials: true,
    }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Controllers
const authController = new AuthController();
const userController = new UserController();
const webhookController = new WebhookController(adapter);

// Public routes (no auth required)
app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);
app.post("/api/webhook", webhookController.handleWebhook);

// Protected routes (auth required)
app.use(authMiddleware); // Apply auth middleware to all routes below

// User routes
app.get("/api/users/me", authGuard, userController.currentUser);
app.get("/api/users/search", userController.search);
app.get("/api/users/:id", authGuard, userController.getProfileById);
app.patch("/api/users", authGuard, userController.updateProfile);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
