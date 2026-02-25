import { sendApns } from "./apns";
import { sendFcm } from "./fcm";
import type { NotificationPayload, Platform } from "../types.js";

export async function sendNotification(
  token: string,
  platform: Platform,
  payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
  if (platform === "ios") {
    return sendApns(token, payload);
  }
  return sendFcm(token, payload);
}
