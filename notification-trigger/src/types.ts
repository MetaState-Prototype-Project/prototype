/**
 * Common notification payload - works for both iOS (APNS) and Android (FCM).
 * Maps cleanly to platform-specific formats.
 */
export interface NotificationPayload {
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Optional subtitle (iOS) / subtext (Android) */
  subtitle?: string;
  /** Custom data payload - string values only for FCM compatibility */
  data?: Record<string, string>;
  /** Sound name - "default" or custom */
  sound?: string;
  /** Badge count (iOS) */
  badge?: number;
  /** Click action / category (iOS) / channel (Android) */
  clickAction?: string;
}

export type Platform = "ios" | "android";

/**
 * APNS tokens are 64 hex chars; FCM tokens are longer and more varied.
 */
export function detectPlatformFromToken(token: string): Platform {
  const cleaned = token.replace(/\s/g, "");
  return /^[a-fA-F0-9]{64}$/.test(cleaned) ? "ios" : "android";
}

export interface SendNotificationRequest {
  /** APNS token (iOS) or FCM token (Android) */
  token: string;
  /** Target platform - optional, auto-detected from token format if omitted */
  platform?: Platform;
  /** Common notification payload */
  payload: NotificationPayload;
}
