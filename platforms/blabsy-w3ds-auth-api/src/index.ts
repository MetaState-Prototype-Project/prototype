import "reflect-metadata";
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import path from "path";
import { AuthController } from "./controllers/AuthController";
import { initializeApp, cert, applicationDefault, getApps } from "firebase-admin/app";
import * as fs from "fs";
import { Web3Adapter } from "./web3adapter";
import { WebhookController, adapter } from "./controllers/WebhookController";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 3000;

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const authController = new AuthController();

// Initialize Firebase Admin SDK (only if credentials are available)
let firebaseInitialized = false;
try {
    // Check if already initialized
    if (getApps().length > 0) {
        firebaseInitialized = true;
        console.log("✅ Firebase Admin SDK already initialized");
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CREDENTIALS_PATH) {
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CREDENTIALS_PATH;
        
        // Explicitly load credentials from file if path is provided
        if (credentialsPath && fs.existsSync(credentialsPath)) {
            try {
                const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
                initializeApp({
                    credential: cert(serviceAccount),
                });
                firebaseInitialized = true;
                console.log("✅ Firebase Admin SDK initialized with service account file");
            } catch (fileError: any) {
                console.error("❌ Failed to load service account file:", fileError.message);
                console.error("   File path:", credentialsPath);
                // Fall back to applicationDefault
                try {
                    initializeApp({
                        credential: applicationDefault(),
                    });
                    firebaseInitialized = true;
                    console.log("✅ Firebase Admin SDK initialized with applicationDefault (fallback)");
                } catch (fallbackError: any) {
                    console.error("❌ Failed to initialize with applicationDefault:", fallbackError.message);
                }
            }
        } else {
            // Try applicationDefault (for GCP metadata service or other default locations)
            try {
                initializeApp({
                    credential: applicationDefault(),
                });
                firebaseInitialized = true;
                console.log("✅ Firebase Admin SDK initialized with applicationDefault");
            } catch (defaultError: any) {
                console.error("❌ Failed to initialize with applicationDefault:", defaultError.message);
                if (credentialsPath) {
                    console.error("   Credentials path was set but file not found:", credentialsPath);
                }
            }
        }
    } else {
        console.warn("⚠️  Firebase credentials not configured. Firebase features will be disabled.");
        console.warn("   Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_CREDENTIALS_PATH environment variable");
    }
} catch (error: any) {
    console.error("❌ Failed to initialize Firebase Admin SDK:", error.message);
    console.error("   Stack:", error.stack);
    console.warn("⚠️  Firebase features will be disabled.");
}

if (!firebaseInitialized) {
    console.warn("⚠️  Firebase Admin SDK not initialized. Webhook and watcher features may fail.");
}

// Initialize Web3Adapter
const web3Adapter = new Web3Adapter();

web3Adapter.initialize().catch((error) => {
    console.error("Failed to initialize Web3Adapter:", error);
    process.exit(1);
});

// Register webhook endpoint

const webhookController = new WebhookController();

app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);
app.post("/api/webhook", webhookController.handleWebhook);

// Debug endpoints for monitoring duplicate prevention
app.get("/api/debug/watcher-stats", (req, res) => {
    try {
        const stats = web3Adapter.getWatcherStats();
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to get watcher stats" });
    }
});

app.post("/api/debug/clear-processed-ids", (req, res) => {
    try {
        web3Adapter.clearAllProcessedIds();
        res.json({ success: true, message: "All processed IDs cleared" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to clear processed IDs" });
    }
});

app.get("/api/debug/locked-ids", (req, res) => {
    try {
        // Access locked IDs from the exported adapter
        const lockedIds = adapter.lockedIds || [];
        res.json({ success: true, lockedIds, count: lockedIds.length });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to get locked IDs" });
    }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received. Shutting down...");
    await web3Adapter.shutdown();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
