import "reflect-metadata";
import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { AppDataSource } from "./database/data-source";
import { UserController } from "./controllers/UserController";
import { GroupController } from "./controllers/GroupController";
import { WebhookController } from "./controllers/WebhookController";
import { adapter } from "./web3adapter";
import path from "path";

config({ path: path.resolve(__dirname, "../../../../.env") });

const app = express();
const port = process.env.PORT || 3001;

// Initialize database connection
AppDataSource.initialize()
    .then(async () => {
        console.log("Database connection established");
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
        ],
        credentials: true,
    }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Controllers
const userController = new UserController();
const groupController = new GroupController();
const webhookController = new WebhookController(adapter);

// Public routes (no auth required for now)
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "group-charter-manager-api" });
});

// Webhook route (no auth required)
app.post("/api/webhook", webhookController.handleWebhook);

// User CRUD routes
app.post("/api/users", userController.createUser);
app.get("/api/users", userController.getAllUsers);
app.get("/api/users/me", userController.getCurrentUser);
app.get("/api/users/:id", userController.getUserById);
app.put("/api/users", userController.updateUser);
app.delete("/api/users/:id", userController.deleteUser);
app.get("/api/users/ename/:ename", userController.getUserByEname);

// Group CRUD routes
app.post("/api/groups", groupController.createGroup);
app.get("/api/groups", groupController.getAllGroups);
app.get("/api/groups/my", groupController.getUserGroups);
app.get("/api/groups/:id", groupController.getGroupById);
app.put("/api/groups/:id", groupController.updateGroup);
app.delete("/api/groups/:id", groupController.deleteGroup);

// Group participant routes
app.get("/api/groups/:groupId", groupController.getGroup);
app.post("/api/groups/:groupId/participants", groupController.addParticipants);
app.delete("/api/groups/:groupId/participants/:userId", groupController.removeParticipant);

// Start server
app.listen(port, () => {
    console.log(`Group Charter Manager API running on port ${port}`);
}); 