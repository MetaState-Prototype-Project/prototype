import "reflect-metadata";
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { AppDataSource } from "./database/data-source";
import { UserController } from "./controllers/UserController";
import { GroupController } from "./controllers/GroupController";
import { MessageController } from "./controllers/MessageController";
import { WebhookController } from "./controllers/WebhookController";
import { AuthController } from "./controllers/AuthController";
import { PlatformEVaultService } from "./services/PlatformEVaultService";
import { authMiddleware, authGuard } from "./middleware/auth";
import { adapter } from "./web3adapter";
import path from "path";

config({ path: path.resolve(__dirname, "../../../../.env") });

const app = express();
const port = process.env.PORT || 3002;

// Initialize database connection and platform eVault
AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");
        
        // Initialize platform eVault for Cerberus
        try {
            const platformService = PlatformEVaultService.getInstance();
            const exists = await platformService.checkPlatformEVaultExists();
            
            if (!exists) {
                console.log("🔧 Creating platform eVault for Cerberus...");
                const result = await platformService.createPlatformEVault();
                console.log(`✅ Platform eVault created successfully: ${result.w3id}`);
            } else {
                console.log("✅ Platform eVault already exists for Cerberus");
            }
        } catch (error) {
            console.error("❌ Failed to initialize platform eVault:", error);
            // Don't exit the process, just log the error
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
const messageController = new MessageController();
const webhookController = new WebhookController(adapter);
const authController = new AuthController();

// Public routes (no auth required)
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "cerberus-api" });
});

// Auth routes (no auth required)
app.get("/api/auth/offer", authController.getOffer.bind(authController));
app.post("/api/auth", authController.login.bind(authController));
app.get("/api/auth/sessions/:id", authController.sseStream.bind(authController));

// Webhook route (no auth required)
app.post("/api/webhook", webhookController.handleWebhook.bind(webhookController));

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

// Group participant routes
app.get("/api/groups/:groupId", authGuard, groupController.getGroup.bind(groupController));
app.post("/api/groups/:groupId/participants", authGuard, groupController.addParticipants.bind(groupController));
app.delete("/api/groups/:groupId/participants/:userId", authGuard, groupController.removeParticipant.bind(groupController));

// Message CRUD routes
app.post("/api/messages", authGuard, messageController.createMessage.bind(messageController));
app.get("/api/messages", authGuard, messageController.getUserMessages.bind(messageController));
app.get("/api/messages/:id", authGuard, messageController.getMessageById.bind(messageController));
app.put("/api/messages/:id", authGuard, messageController.updateMessage.bind(messageController));
app.delete("/api/messages/:id", authGuard, messageController.deleteMessage.bind(messageController));
app.patch("/api/messages/:id/archive", authGuard, messageController.archiveMessage.bind(messageController));

// Group messages routes
app.get("/api/groups/:groupId/messages", authGuard, messageController.getGroupMessages.bind(messageController));

// Start server
app.listen(port, () => {
    console.log(`Cerberus API running on port ${port}`);
});

// Export platform service for use in other parts of the application
export { PlatformEVaultService }; 