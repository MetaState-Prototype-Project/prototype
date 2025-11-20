import "reflect-metadata";
import path from "node:path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import "./types/express";
import { AppDataSource } from "./database/data-source";
import { UserController } from "./controllers/UserController";
import { AuthController } from "./controllers/AuthController";
import { WebhookController } from "./controllers/WebhookController";
import { ReferenceController } from "./controllers/ReferenceController";
import { CalculationController } from "./controllers/CalculationController";
import { PlatformController } from "./controllers/PlatformController";
import { GroupController } from "./controllers/GroupController";
import { DashboardController } from "./controllers/DashboardController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { adapter } from "./web3adapter/watchers/subscriber";
import { JobQueueService } from "./services/JobQueueService";
import { PollReputationWorker } from "./workers/PollReputationWorker";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 8765;

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

// Initialize job queue and worker
const jobQueueService = new JobQueueService();
const pollReputationWorker = new PollReputationWorker(jobQueueService);

// Controllers
const userController = new UserController();
const authController = new AuthController();
const webhookController = new WebhookController(jobQueueService);
const referenceController = new ReferenceController();
const calculationController = new CalculationController();
const platformController = new PlatformController();
const groupController = new GroupController();
const dashboardController = new DashboardController();

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

// Webhook route (no auth required)
app.post("/api/webhook", webhookController.handleWebhook);

// Platform routes (public)
app.get("/api/platforms", platformController.getPlatforms);
app.get("/api/platforms/search", platformController.searchPlatforms);

// Protected routes (auth required)
app.use(authMiddleware); // Apply auth middleware to all routes below

// User routes
app.get("/api/users/me", authGuard, userController.currentUser);
app.get("/api/users/search", userController.search);
app.get("/api/users/:id", authGuard, userController.getProfileById);
app.patch("/api/users", authGuard, userController.updateProfile);

// Group routes
app.get("/api/groups/search", groupController.search);

// Dashboard routes
app.get("/api/dashboard/stats", authGuard, dashboardController.getStats);
app.get("/api/dashboard/activities", authGuard, dashboardController.getActivities);

// Reference routes
app.post("/api/references", authGuard, referenceController.createReference);
app.get("/api/references/target/:targetType/:targetId", referenceController.getReferencesForTarget);
app.get("/api/references/my", authGuard, referenceController.getUserReferences);
app.patch("/api/references/:referenceId/revoke", authGuard, referenceController.revokeReference);

// Calculation routes
app.post("/api/reputation/calculate", authGuard, calculationController.calculateReputation);
app.get("/api/reputation/calculations/:calculationId", authGuard, calculationController.getCalculationResult);
app.get("/api/reputation/calculations/my", authGuard, calculationController.getUserCalculations);

// Start server
app.listen(port, () => {
    console.log(`eReputation API server running on port ${port}`);
});
