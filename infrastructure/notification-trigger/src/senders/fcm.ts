import admin from "firebase-admin";
import type { NotificationPayload } from "../types";

let initialized = false;

export function initFcm(): boolean {
  if (initialized) return true;

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.warn("[FCM] Missing GOOGLE_APPLICATION_CREDENTIALS");
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    initialized = true;
    console.log("[FCM] Initialized");
    return true;
  } catch (err) {
    console.error("[FCM] Failed to initialize:", err);
    return false;
  }
}

export async function sendFcm(
  token: string,
  payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
  if (!initialized) {
    return { success: false, error: "FCM not configured" };
  }

  const data =
    payload.data &&
    Object.fromEntries(
      Object.entries(payload.data).map(([k, v]) => [k, String(v)])
    );

  const message: admin.messaging.Message = {
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    ...(data && Object.keys(data).length > 0 && { data }),
    android: {
      notification: {
        title: payload.title,
        body: payload.body,
        sound: payload.sound ?? "default",
        channelId: payload.clickAction ?? "default",
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
            ...(payload.subtitle && { subtitle: payload.subtitle }),
          },
          sound: payload.sound ?? "default",
          ...(payload.badge !== undefined && { badge: payload.badge }),
          ...(payload.clickAction && { category: payload.clickAction }),
        },
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
