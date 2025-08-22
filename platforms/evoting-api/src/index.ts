import "reflect-metadata";
import path from "node:path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { AppDataSource } from "./database/data-source";
import { AuthController } from "./controllers/AuthController";
import { UserController } from "./controllers/UserController";
import { PollController } from "./controllers/PollController";
import { VoteController } from "./controllers/VoteController";
import { WebhookController } from "./controllers/WebhookController";
import { SigningController } from "./controllers/SigningController";
import { GroupController } from "./controllers/GroupController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { adapter } from "./web3adapter/watchers/subscriber";
import { CronManagerService } from "./services/CronManagerService";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 4000;

// Initialize database connection and adapter
AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");
        console.log("Web3 adapter initialized");
        
        // Initialize controllers after database is ready
        try {
            signingController = new SigningController();
            console.log("SigningController initialized successfully");
        } catch (error) {
            console.error("Failed to initialize SigningController:", error);
        }
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
const authController = new AuthController();
const userController = new UserController();
const pollController = new PollController();
const voteController = new VoteController();
const webhookController = new WebhookController();
const groupController = new GroupController();
let signingController: SigningController | null = null;

// Public routes (no auth required)
app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);
app.post("/api/webhook", webhookController.handleWebhook);

// Signing routes (public for signing flow)
app.post("/api/signing/sessions", (req, res) => {
    if (!signingController) {
        return res.status(503).json({ error: "Signing service not ready" });
    }
    signingController.createSigningSession(req, res);
});
app.get("/api/signing/sessions/:sessionId/status", (req, res) => {
    if (!signingController) {
        return res.status(503).json({ error: "Signing service not ready" });
    }
    signingController.getSigningSessionStatus(req, res);
});
app.post("/api/signing/callback", (req, res) => {
    if (!signingController) {
        return res.status(503).json({ error: "Signing service not ready" });
    }
    signingController.handleSignedPayload(req, res);
});
app.get("/api/signing/sessions/:sessionId", (req, res) => {
    if (!signingController) {
        return res.status(503).json({ error: "Signing service not ready" });
    }
    signingController.getSigningSession(req, res);
});

// Test endpoint to verify signing service is working
app.get("/api/signing/test", (req, res) => {
    try {
        if (!signingController) {
            return res.status(503).json({ 
                error: "Signing service not ready", 
                message: "Service is still initializing" 
            });
        }
        const testResult = signingController.testConnection();
        res.json({ 
            message: "Signing service is working", 
            timestamp: new Date().toISOString(),
            testResult
        });
    } catch (error) {
        res.status(500).json({ 
            error: "Signing service test failed", 
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({ 
        status: "ok",
        timestamp: new Date().toISOString(),
        services: {
            database: AppDataSource.isInitialized ? "connected" : "disconnected",
            signing: signingController ? "ready" : "initializing"
        }
    });
});

// Cron job management endpoints
app.get("/api/cron/status", (req, res) => {
    try {
        const cronManager = new CronManagerService();
        const status = cronManager.getJobStatus();
        res.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            cronJobs: status
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to get cron job status",
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

app.post("/api/cron/deadline-check", (req, res) => {
    try {
        const cronManager = new CronManagerService();
        cronManager.manualDeadlineCheck().then(() => {
            res.json({
                message: "Manual deadline check completed",
                timestamp: new Date().toISOString()
            });
        }).catch((error) => {
            res.status(500).json({
                error: "Manual deadline check failed",
                message: error instanceof Error ? error.message : String(error)
            });
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to trigger manual deadline check",
            message: error instanceof Error ? error.message : String(error)
        });
    }
});

// Protected routes (auth required)
app.use(authMiddleware); // Apply auth middleware to all routes below

// User routes
app.get("/api/users/me", authGuard, userController.currentUser);
app.get("/api/users/search", userController.search);
app.get("/api/users/:id", authGuard, userController.getProfileById);
app.patch("/api/users", authGuard, userController.updateProfile);

// Group routes
app.get("/api/groups/my", authGuard, groupController.getUserGroups);
app.get("/api/groups/:id", authGuard, groupController.getGroupById);
app.post("/api/groups", authGuard, groupController.createGroup);
app.put("/api/groups/:id", authGuard, groupController.updateGroup);
app.delete("/api/groups/:id", authGuard, groupController.deleteGroup);
app.post("/api/groups/:id/members", authGuard, groupController.addMembers);
app.delete("/api/groups/:id/members/:userId", authGuard, groupController.removeMember);
app.post("/api/groups/:id/admins", authGuard, groupController.addAdmins);
app.delete("/api/groups/:id/admins/:userId", authGuard, groupController.removeAdmin);

// Poll routes
app.get("/api/polls", pollController.getAllPolls);
app.get("/api/polls/my", authGuard, pollController.getPollsByCreator);
app.post("/api/polls", authGuard, pollController.createPoll);
app.put("/api/polls/:id", authGuard, pollController.updatePoll);
app.delete("/api/polls/:id", authGuard, pollController.deletePoll);

// Vote routes
app.post("/api/votes", voteController.createVote.bind(voteController)); // Create normal/point/rank vote (old format)
app.post("/api/votes/:pollId", voteController.createVote.bind(voteController)); // Create normal/point/rank vote (new format)
app.get("/api/votes/:pollId", voteController.getVotesByPoll.bind(voteController)); // Get votes by poll
app.get("/api/votes/:pollId/user/:userId", voteController.getUserVote.bind(voteController)); // Get user's vote
app.get("/api/votes/:pollId/results", voteController.getPollResults.bind(voteController)); // Get poll results

// Poll-specific vote endpoints (for frontend compatibility)
app.get("/api/polls/:pollId/votes", voteController.getVotesByPoll.bind(voteController)); // Get votes for a poll
app.get("/api/polls/:pollId/vote", voteController.getUserVote.bind(voteController)); // Get user's vote for a poll
app.get("/api/polls/:pollId/results", voteController.getPollResults.bind(voteController)); // Get poll results
app.get("/api/polls/:pollId/blind-tally", voteController.tallyBlindVotes.bind(voteController)); // Tally blind votes (frontend compatibility)

// Blind voting routes
app.post("/api/votes/:pollId/blind", voteController.submitBlindVote.bind(voteController)); // Submit blind vote
app.post("/api/votes/:pollId/register", voteController.registerBlindVoteVoter.bind(voteController)); // Register voter
app.post("/api/votes/:pollId/generate", voteController.generateVoteData.bind(voteController)); // Generate vote data for eID wallet
app.get("/api/votes/:pollId/tally", voteController.tallyBlindVotes.bind(voteController)); // Tally blind votes

// Generic poll route (must come last to avoid conflicts with specific routes)
app.get("/api/polls/:id", pollController.getPollById);

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
