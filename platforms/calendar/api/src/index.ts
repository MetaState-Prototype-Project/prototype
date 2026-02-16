import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import express from "express";
import cors from "cors";

// Load .env: try monorepo root, then calendar-api parent, then cwd (no fallback)
const candidates = [
  path.resolve(__dirname, "../../../../.env"), // repo root from dist/
  path.resolve(__dirname, "../../../.env"),   // repo root from src/
  path.resolve(process.cwd(), ".env"),
];
const envPath = candidates.find((p) => fs.existsSync(p));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  console.warn(
    "No .env found at",
    candidates.join(", "),
    "- env vars must be set by shell or elsewhere"
  );
}
import { AuthController } from "./controllers/AuthController";
import { EventsController } from "./controllers/EventsController";
import { authMiddleware } from "./middleware/auth";

const app = express();
const port = process.env.PORT ?? 4001;

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());

const authController = new AuthController();
const eventsController = new EventsController();

app.get("/api/auth/offer", authController.getOffer);
app.get("/api/auth/sessions/:id", authController.sseStream);
app.post("/api/auth", authController.login);

app.get("/api/events", authMiddleware, eventsController.list);
app.post("/api/events", authMiddleware, eventsController.create);
app.patch("/api/events/:id", authMiddleware, eventsController.update);
app.delete("/api/events/:id", authMiddleware, eventsController.remove);

app.listen(port, () => {
  console.log(`Calendar API running on port ${port}`);
});
