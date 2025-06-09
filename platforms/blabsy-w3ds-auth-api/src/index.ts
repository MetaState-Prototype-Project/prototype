import "reflect-metadata";
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import path from "path";
import { AuthController } from "./controllers/AuthController";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { Web3Adapter } from "./web3adapter";

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
const web3Adapter = new Web3Adapter({
    registryUrl: process.env.PUBLIC_REGISTRY_URL || "",
    webhookSecret: process.env.WEBHOOK_SECRET || "",
    webhookEndpoint: process.env.WEBHOOK_ENDPOINT || "/webhook/evault",
});

// Initialize adapter
web3Adapter.initialize().catch((error) => {
    console.error("Failed to initialize Web3Adapter:", error);
    process.exit(1);
});

// Register webhook endpoint
app.post("/webhook/evault", web3Adapter.getWebhookHandler());

app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM received. Shutting down...");
    await web3Adapter.shutdown();
    process.exit(0);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
