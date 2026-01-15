import "reflect-metadata";
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { AppDataSource } from "./database/data-source";
import path from "path";
import { AuthController } from "./controllers/AuthController";
import { FileController } from "./controllers/FileController";
import { InvitationController } from "./controllers/InvitationController";
import { SignatureController } from "./controllers/SignatureController";
import { UserController } from "./controllers/UserController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { WebhookController } from "./controllers/WebhookController";
import { adapter } from "./web3adapter/watchers/subscriber";
import { PlatformEVaultService } from "./services/PlatformEVaultService";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 3004;

// Initialize database connection and adapter
AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");
        console.log("Web3 adapter initialized");
        
        // Initialize platform eVault for eSigner
        try {
            const platformService = PlatformEVaultService.getInstance();
            const exists = await platformService.checkPlatformEVaultExists();
            
            if (!exists) {
                console.log("🔧 Creating platform eVault for eSigner...");
                const result = await platformService.createPlatformEVault();
                console.log(`✅ Platform eVault created successfully: ${result.w3id}`);
            } else {
                console.log("✅ Platform eVault already exists for eSigner");
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
const invitationController = new InvitationController();
const signatureController = new SignatureController();
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
app.patch("/api/files/:id", authGuard, fileController.updateFile);
app.get("/api/files/:id/download", authGuard, fileController.downloadFile);
app.delete("/api/files/:id", authGuard, fileController.deleteFile);
app.get("/api/files/:fileId/signatures", authGuard, fileController.getFileSignatures);

// User routes
app.get("/api/users", authGuard, userController.currentUser);
app.get("/api/users/search", authGuard, userController.search);

// Invitation routes
app.post("/api/files/:fileId/invite", authGuard, invitationController.inviteSignees);
app.get("/api/files/:fileId/invitations", authGuard, invitationController.getFileInvitations);
app.get("/api/invitations", authGuard, invitationController.getUserInvitations);
app.post("/api/invitations/:id/decline", authGuard, invitationController.declineInvitation);

// Signature routes
app.post("/api/signatures/session", authGuard, signatureController.createSigningSession);
app.get("/api/signatures/session/:id", signatureController.getSigningSessionStatus);
app.post("/api/signatures/callback", signatureController.handleSignedPayload);

// Start server
app.listen(port, () => {
    console.log(`eSigner API server running on port ${port}`);
});

