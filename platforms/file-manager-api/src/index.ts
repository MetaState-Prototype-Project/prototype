import "reflect-metadata";
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { AppDataSource } from "./database/data-source";
import path from "path";
import { AuthController } from "./controllers/AuthController";
import { FileController } from "./controllers/FileController";
import { FolderController } from "./controllers/FolderController";
import { AccessController } from "./controllers/AccessController";
import { TagController } from "./controllers/TagController";
import { UserController } from "./controllers/UserController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { WebhookController } from "./controllers/WebhookController";
import { adapter } from "./web3adapter/watchers/subscriber";
import { PlatformEVaultService } from "./services/PlatformEVaultService";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 3005;

// Initialize database connection and adapter
AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");
        console.log("Web3 adapter initialized");
        
        // Initialize platform eVault for File Manager
        try {
            const platformService = PlatformEVaultService.getInstance();
            const exists = await platformService.checkPlatformEVaultExists();
            
            if (!exists) {
                console.log("🔧 Creating platform eVault for File Manager...");
                const result = await platformService.createPlatformEVault();
                console.log(`✅ Platform eVault created successfully: ${result.w3id}`);
            } else {
                console.log("✅ Platform eVault already exists for File Manager");
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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Controllers
const authController = new AuthController();
const fileController = new FileController();
const folderController = new FolderController();
const accessController = new AccessController();
const tagController = new TagController();
const userController = new UserController();
const webhookController = new WebhookController(adapter);

// Public routes (no auth required)
app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);
app.post("/api/webhook", webhookController.handleWebhook);

// Protected routes (auth required)
app.use(authMiddleware);

// File routes
app.post("/api/files", authGuard, fileController.uploadFile);
app.get("/api/files", authGuard, fileController.getFiles);
app.get("/api/files/:id", authGuard, fileController.getFile);
app.get("/api/files/:id/download", authGuard, fileController.downloadFile);
app.get("/api/files/:id/preview", authGuard, fileController.previewFile);
app.patch("/api/files/:id", authGuard, fileController.updateFile);
app.delete("/api/files/:id", authGuard, fileController.deleteFile);
app.post("/api/files/:id/move", authGuard, fileController.moveFile);

// Folder routes
app.post("/api/folders", authGuard, folderController.createFolder);
app.get("/api/folders", authGuard, folderController.getFolders);
app.get("/api/folders/tree", authGuard, folderController.getFolderTree);
app.get("/api/folders/:id", authGuard, folderController.getFolder);
app.get("/api/folders/:id/contents", authGuard, folderController.getFolderContents);
app.patch("/api/folders/:id", authGuard, folderController.updateFolder);
app.delete("/api/folders/:id", authGuard, folderController.deleteFolder);
app.post("/api/folders/:id/move", authGuard, folderController.moveFolder);

// Access routes
app.post("/api/files/:id/access", authGuard, accessController.grantFileAccess);
app.delete("/api/files/:id/access/:userId", authGuard, accessController.revokeFileAccess);
app.get("/api/files/:id/access", authGuard, accessController.getFileAccess);
app.post("/api/folders/:id/access", authGuard, accessController.grantFolderAccess);
app.delete("/api/folders/:id/access/:userId", authGuard, accessController.revokeFolderAccess);
app.get("/api/folders/:id/access", authGuard, accessController.getFolderAccess);

// Tag routes
app.post("/api/tags", authGuard, tagController.createTag);
app.get("/api/tags", authGuard, tagController.getTags);
app.patch("/api/tags/:id", authGuard, tagController.updateTag);
app.delete("/api/tags/:id", authGuard, tagController.deleteTag);
app.post("/api/files/:id/tags", authGuard, tagController.addTagToFile);
app.delete("/api/files/:id/tags/:tagId", authGuard, tagController.removeTagFromFile);
app.post("/api/folders/:id/tags", authGuard, tagController.addTagToFolder);
app.delete("/api/folders/:id/tags/:tagId", authGuard, tagController.removeTagFromFolder);

// User routes
app.get("/api/users", authGuard, userController.currentUser);
app.get("/api/users/search", authGuard, userController.search);

// Start server
app.listen(port, () => {
    console.log(`File Manager API server running on port ${port}`);
});

