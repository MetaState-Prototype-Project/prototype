import apn from "apn";
import type { NotificationPayload } from "../types";

let provider: apn.Provider | null = null;

export function initApns(): boolean {
  const keyPath = process.env.APNS_KEY_PATH;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;

  if (!keyPath || !keyId || !teamId || !bundleId) {
    console.warn(
      "[APNS] Missing config: APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID"
    );
    return false;
  }

  try {
    provider = new apn.Provider({
      token: {
        key: keyPath,
        keyId,
        teamId,
      },
      production: process.env.APNS_PRODUCTION === "true",
    });
    console.log("[APNS] Provider initialized");
    return true;
  } catch (err) {
    console.error("[APNS] Failed to initialize:", err);
    return false;
  }
}

export async function sendApns(
  token: string,
  payload: NotificationPayload
): Promise<{ success: boolean; error?: string }> {
  if (!provider) {
    return { success: false, error: "APNS not configured" };
  }

  const note = new apn.Notification();
  note.alert = {
    title: payload.title,
    body: payload.body,
    ...(payload.subtitle && { subtitle: payload.subtitle }),
  };
  note.topic = process.env.APNS_BUNDLE_ID!;
  note.sound = payload.sound ?? "default";
  if (payload.badge !== undefined) note.badge = payload.badge;
  if (payload.clickAction) note.aps = { ...note.aps, category: payload.clickAction };
  if (payload.data && Object.keys(payload.data).length > 0) {
    note.payload = payload.data;
  }

  try {
    const result = await provider.send(note, token);
    if (result.failed.length > 0) {
      const fail = result.failed[0];
      const err =
        fail.response?.reason ?? fail.status ?? fail.error?.message ?? "Unknown";
      return { success: false, error: String(err) };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function shutdownApns(): void {
  if (provider) {
    provider.shutdown();
    provider = null;
  }
}
