import "reflect-metadata";
import path from "node:path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { AppDataSource } from "./database/data-source";
import { UserController } from "./controllers/UserController";
import { AuthController } from "./controllers/AuthController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { adapter } from "./web3adapter/watchers/subscriber";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 4001;

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
        origin: "*",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
const userController = new UserController();
const authController = new AuthController();

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({ 
        status: "ok",
        timestamp: new Date().toISOString(),
        services: {
            database: AppDataSource.isInitialized ? "connected" : "disconnected",
            web3adapter: "ready"
        }
    });
});

// Public routes (no auth required)
app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);

// Protected routes (auth required)
app.use(authMiddleware); // Apply auth middleware to all routes below

// User routes
app.get("/api/users/me", authGuard, userController.currentUser);
app.get("/api/users/search", userController.search);
app.get("/api/users/:id", authGuard, userController.getProfileById);
app.patch("/api/users", authGuard, userController.updateProfile);

// Start server
app.listen(port, () => {
    console.log(`DreamSync API server running on port ${port}`);
});
