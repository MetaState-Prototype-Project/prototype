import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response } from "express";
import { initApns, shutdownApns } from "./senders/apns";
import { initFcm } from "./senders/fcm";
import { sendNotification } from "./senders";
import type { NotificationPayload, Platform } from "./types";
import { detectPlatformFromToken } from "./types";

// Load root .env (two levels up from src/)
dotenv.config({
  path: path.resolve(__dirname, "../../../.env"),
});

const app = express();
const PORT = process.env.NOTIFICATION_TRIGGER_PORT || 3998;

app.use(cors());
app.use(express.json());

// Serve static UI
const publicDir = path.join(path.resolve(__dirname, ".."), "public");
app.use(express.static(publicDir));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    apns: !!process.env.APNS_KEY_PATH,
    fcm: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
  });
});

app.post("/api/send", async (req: Request, res: Response) => {
  try {
    const { token, platform: platformParam, payload } = req.body;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid 'token' (APNS/FCM token)",
      });
    }

    const platform: Platform =
      platformParam && ["ios", "android"].includes(platformParam)
        ? platformParam
        : detectPlatformFromToken(token);

    if (!payload?.title || !payload?.body) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid 'payload' (requires title and body)",
      });
    }

    const notificationPayload: NotificationPayload = {
      title: String(payload.title),
      body: String(payload.body),
      ...(payload.subtitle && { subtitle: String(payload.subtitle) }),
      ...(payload.data && {
        data: Object.fromEntries(
          Object.entries(payload.data).map(([k, v]) => [k, String(v)])
        ),
      }),
      ...(payload.sound && { sound: String(payload.sound) }),
      ...(payload.badge !== undefined && { badge: Number(payload.badge) }),
      ...(payload.clickAction && { clickAction: String(payload.clickAction) }),
    };

    const result = await sendNotification(
      token.trim(),
      platform,
      notificationPayload
    );

    if (result.success) {
      return res.json({ success: true, message: "Notification sent" });
    }

    return res.status(500).json({
      success: false,
      error: result.error ?? "Failed to send notification",
    });
  } catch (err) {
    console.error("Send error:", err);
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Internal server error",
    });
  }
});

// Initialize providers
initApns();
initFcm();

const server = app.listen(PORT, () => {
  console.log(`Notification trigger running at http://localhost:${PORT}`);
  console.log(`  API: POST /api/send`);
  console.log(`  UI:  http://localhost:${PORT}/`);
});

process.on("SIGTERM", () => {
  shutdownApns();
  server.close();
});
