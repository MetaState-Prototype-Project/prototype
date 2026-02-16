import "reflect-metadata";
import path from "node:path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { AppDataSource } from "./database/data-source";
import { UserController } from "./controllers/UserController";
import { AuthController } from "./controllers/AuthController";
import { WebhookController } from "./controllers/WebhookController";
import { WishlistController } from "./controllers/WishlistController";
import { MatchController } from "./controllers/MatchController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { adapter } from "./web3adapter/watchers/subscriber";
import { MatchingJob } from "./services/MatchingJob";
import { PlatformEVaultService } from "./services/PlatformEVaultService";
import { WishlistSummaryService } from "./services/WishlistSummaryService";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 4001;

// Initialize database connection and adapter
AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");
        console.log("Web3 adapter initialized");
        
        // Initialize platform eVault for DreamSync
        try {
            const platformService = PlatformEVaultService.getInstance();
            const exists = await platformService.checkPlatformEVaultExists();
            
            if (!exists) {
                console.log("Creating platform eVault for DreamSync...");
                const result = await platformService.createPlatformEVault();
                console.log(`Platform eVault created successfully: ${result.w3id}`);
            } else {
                console.log("Platform eVault already exists for DreamSync");
            }
        } catch (error) {
            console.error("Failed to initialize platform eVault:", error);
            // Don't exit the process, just log the error
        }
        
        // Summarize all wishlists on platform start
        try {
            const wishlistSummaryService = WishlistSummaryService.getInstance();
            await wishlistSummaryService.summarizeAllWishlists();
        } catch (error) {
            console.error("Failed to summarize wishlists:", error);
            // Don't exit the process, just log the error
        }
        
        // Start AI matching job (disabled automatic startup)
        const matchingJob = new MatchingJob();
        // matchingJob.start(60); // Run every 60 minutes - DISABLED
        console.log("AI matching job initialized (manual trigger only)");
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
const webhookController = new WebhookController();
const wishlistController = new WishlistController();
const matchController = new MatchController();

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

// Protected routes (auth required)
app.use(authMiddleware); // Apply auth middleware to all routes below

// User routes
app.get("/api/users/me", authGuard, userController.currentUser);
app.get("/api/users/search", userController.search);
app.get("/api/users/:id", authGuard, userController.getProfileById);
app.patch("/api/users", authGuard, userController.updateProfile);

// Wishlist routes
app.post("/api/wishlists", authGuard, wishlistController.createWishlist);
app.get("/api/wishlists", authGuard, wishlistController.getUserWishlists);
app.get("/api/wishlists/public", wishlistController.getPublicWishlists);
app.get("/api/wishlists/:id", authGuard, wishlistController.getWishlistById);
app.put("/api/wishlists/:id", authGuard, wishlistController.updateWishlist);
app.delete("/api/wishlists/:id", authGuard, wishlistController.deleteWishlist);

// Match routes
app.get("/api/matches", authGuard, matchController.getUserMatches);
app.patch("/api/matches/:id", authGuard, matchController.updateMatchStatus);
app.post("/api/matches/trigger", matchController.triggerMatching); // Manual trigger (no auth required for admin use)
app.post("/api/matches/process-unmessaged", matchController.processUnmessagedMatches); // Process unmessaged matches (no auth required for admin use)
app.get("/api/matches/stats", matchController.getMatchingStats); // Matching statistics

// Start server
app.listen(port, () => {
    console.log(`DreamSync API server running on port ${port}`);
});

// Export platform service for use in other parts of the application
export { PlatformEVaultService };
