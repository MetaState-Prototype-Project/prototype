import "reflect-metadata";
import path from "path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import "./types/express";
import { AppDataSource } from "./database/data-source";
import { UserController } from "./controllers/UserController";
import { AuthController } from "./controllers/AuthController";
import { WebhookController } from "./controllers/WebhookController";
import { GroupController } from "./controllers/GroupController";
import { CurrencyController } from "./controllers/CurrencyController";
import { LedgerController } from "./controllers/LedgerController";
import { authMiddleware, authGuard } from "./middleware/auth";
import { adapter } from "./web3adapter/watchers/subscriber";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 8989;

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

// Controllers
const userController = new UserController();
const authController = new AuthController();
const webhookController = new WebhookController();
const groupController = new GroupController();
const currencyController = new CurrencyController();
const ledgerController = new LedgerController();

// Health check endpoint
app.get("/api/health", (req: express.Request, res: express.Response) => {
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

// Group routes
app.get("/api/groups/search", groupController.search);
app.get("/api/groups/my", authGuard, groupController.getUserGroups);

// Currency routes
app.post("/api/currencies", authGuard, currencyController.createCurrency);
app.get("/api/currencies", currencyController.getAllCurrencies);
app.get("/api/currencies/:id", currencyController.getCurrencyById);
app.get("/api/currencies/group/:groupId", currencyController.getCurrenciesByGroup);
app.post("/api/currencies/:id/mint", authGuard, currencyController.mintCurrency);

// Ledger routes
app.get("/api/ledger/balance", authGuard, ledgerController.getBalance);
app.get("/api/ledger/balance/:currencyId", authGuard, ledgerController.getBalanceByCurrencyId);
app.post("/api/ledger/transfer", authGuard, ledgerController.transfer);
app.get("/api/ledger/history", authGuard, ledgerController.getHistory);
app.get("/api/ledger/history/:currencyId", authGuard, ledgerController.getHistory);
app.get("/api/ledger/transaction/:id", authGuard, ledgerController.getTransactionById);
app.get("/api/ledger/account-details/:currencyId", authGuard, ledgerController.getAccountDetails);
app.get("/api/ledger/total-supply/:currencyId", authGuard, ledgerController.getTotalSupply);
app.post("/api/ledger/initialize", authGuard, ledgerController.initializeAccount);

// Start server
app.listen(port, () => {
    console.log(`eCurrency API server running on port ${port}`);
});

