import "reflect-metadata";
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import path from "path";
import { AuthController } from "./controllers/AuthController";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
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

initializeApp({
    credential: applicationDefault(),
});

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
