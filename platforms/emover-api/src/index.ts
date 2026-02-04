import "reflect-metadata";
import path from "node:path";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import { AuthController } from "./controllers/AuthController";
import { EvaultInfoController } from "./controllers/EvaultInfoController";
import { MigrationController } from "./controllers/MigrationController";
import { UserController } from "./controllers/UserController";
import { AdminController } from "./controllers/AdminController";
import { AppDataSource } from "./database/data-source";
import { authGuard, authMiddleware } from "./middleware/auth";
import { adminGuard } from "./middleware/admin";

config({ path: path.resolve(__dirname, "../../../.env") });

const app = express();
const port = process.env.PORT || 4003;

// Initialize database connection
AppDataSource.initialize()
    .then(() => {
        console.log("Database connection established");
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
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
    }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(authMiddleware);

// Controllers
const authController = new AuthController();
const userController = new UserController();
const evaultInfoController = new EvaultInfoController();
const migrationController = new MigrationController();
const adminController = new AdminController();

// Public routes (no auth required)
app.get("/api/auth/offer", authController.getOffer);
app.post("/api/auth", authController.login);
app.get("/api/auth/sessions/:id", authController.sseStream);

// Protected routes (auth required)
app.get("/api/users/me", authGuard, userController.currentUser);
app.get("/api/evault/current", authGuard, evaultInfoController.getCurrent);
app.get("/api/provisioners", authGuard, evaultInfoController.getProvisioners);

// Migration routes
app.post("/api/migration/initiate", authGuard, migrationController.initiate);
app.post("/api/migration/sign", authGuard, migrationController.sign);
app.get("/api/migration/sessions/:id", migrationController.getSessionStatus);
app.post("/api/migration/callback", migrationController.callback);
app.get("/api/migration/status/:id", migrationController.getStatus);
app.post("/api/migration/delete-old", authGuard, migrationController.deleteOld);

// Admin routes (requires admin role)
app.get("/api/admin/enames", authGuard, adminGuard, adminController.listEnames);
app.post("/api/admin/migrate", authGuard, adminGuard, adminController.initiateMigration);

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});

app.listen(port, () => {
    console.log(`Emover API server running on port ${port}`);
});
