import "reflect-metadata";
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { AppDataSource } from "./database/data-source";
import { UserController } from "./controllers/UserController";
import { GroupController } from "./controllers/GroupController";
import { WebhookController } from "./controllers/WebhookController";
import { AuthController } from "./controllers/AuthController";
import { CharterSigningController } from "./controllers/CharterSigningController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { adapter } from "./web3adapter";
import path from "path";

config({ path: path.resolve(__dirname, "../../../../.env") });

const app = express();
const port = process.env.PORT || 3001;

// Initialize database connection
AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");
        
        // Initialize signing controller
        try {
            charterSigningController = new CharterSigningController();
            console.log("CharterSigningController initialized successfully");
        } catch (error) {
            console.error("Failed to initialize CharterSigningController:", error);
        }
    })
    .catch((error: any) => {
        console.error("Error during initialization:", error);
        process.exit(1);
    });

// Middleware
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "OPTIONS", "PATCH", "DELETE"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
        ],
        credentials: true,
    }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Controllers
const userController = new UserController();
const groupController = new GroupController();
const webhookController = new WebhookController(adapter);
const authController = new AuthController();
let charterSigningController: CharterSigningController | null = null;

// Public routes (no auth required)
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "group-charter-manager-api" });
});

// Test endpoint to verify signing service is working
app.get("/api/signing/test", (req, res) => {
    try {
        if (!charterSigningController) {
            return res.json({
                status: "error",
                error: "Signing service not ready",
                signing: "initializing"
            });
        }

        const testResult = charterSigningController.testConnection();
        
        res.json({
            status: "ok",
            message: "Signing service is working",
            signing: testResult ? "ready" : "error"
        });
    } catch (error) {
        res.json({
            status: "error",
            error: "Signing service test failed",
            signing: "error"
        });
    }
});

// Auth routes (no auth required)
app.get("/api/auth/offer", authController.getOffer.bind(authController));
app.post("/api/auth", authController.login.bind(authController));
app.get("/api/auth/sessions/:id", authController.sseStream.bind(authController));

// Webhook route (no auth required)
app.post("/api/webhook", webhookController.handleWebhook.bind(webhookController));

// SSE endpoint for signing status (public - no auth required for real-time updates)
app.get("/api/signing/sessions/:sessionId/status", (req, res) => {
    if (!charterSigningController) {
        return res.status(503).json({ error: "Signing service not ready" });
    }
    charterSigningController.getSigningSessionStatus(req, res);
});

// Signing callback endpoint (public - called by eID Wallet)
app.post("/api/signing/callback", (req, res) => {
    if (!charterSigningController) {
        return res.status(503).json({ error: "Signing service not ready" });
    }
    charterSigningController.handleSignedPayload(req, res);
});

// Apply auth middleware to all routes below
app.use(authMiddleware);

// Protected routes (auth required)
// User CRUD routes
app.post("/api/users", authGuard, userController.createUser.bind(userController));
app.get("/api/users", authGuard, userController.getAllUsers.bind(userController));
app.get("/api/users/me", authGuard, userController.getCurrentUser.bind(userController));
app.get("/api/users/:id", authGuard, userController.getUserById.bind(userController));
app.put("/api/users", authGuard, userController.updateUser.bind(userController));
app.delete("/api/users/:id", authGuard, userController.deleteUser.bind(userController));
app.get("/api/users/ename/:ename", userController.getUserByEname.bind(userController));

// Group CRUD routes
app.post("/api/groups", authGuard, groupController.createGroup.bind(groupController));
app.get("/api/groups", authGuard, groupController.getAllGroups.bind(groupController));
app.get("/api/groups/my", authGuard, groupController.getUserGroups.bind(groupController));
app.get("/api/groups/:id", authGuard, groupController.getGroupById.bind(groupController));
app.put("/api/groups/:id", authGuard, groupController.updateGroup.bind(groupController));
app.delete("/api/groups/:id", authGuard, groupController.deleteGroup.bind(groupController));

// Charter routes
app.put("/api/groups/:id/charter", authGuard, groupController.updateCharter.bind(groupController));
app.get("/api/groups/:id/charter/signing-status", authGuard, groupController.getCharterSigningStatus.bind(groupController));

// Signing routes (protected - require authentication)
app.post("/api/signing/sessions", authGuard, (req, res) => {
    if (!charterSigningController) {
        return res.status(503).json({ error: "Signing service not ready" });
    }
    charterSigningController.createSigningSession(req, res);
});

app.get("/api/signing/sessions/:sessionId", authGuard, (req, res) => {
    if (!charterSigningController) {
        return res.status(503).json({ error: "Signing service not ready" });
    }
    charterSigningController.getSigningSession(req, res);
});

// Group participant routes
app.get("/api/groups/:groupId", authGuard, groupController.getGroup.bind(groupController));
app.post("/api/groups/:groupId/participants", authGuard, groupController.addParticipants.bind(groupController));
app.delete("/api/groups/:groupId/participants/:userId", authGuard, groupController.removeParticipant.bind(groupController));

// Start server
app.listen(port, () => {
    console.log(`Group Charter Manager API running on port ${port}`);
    console.log(`Signing service status: ${charterSigningController ? "ready" : "initializing"}`);
}); 