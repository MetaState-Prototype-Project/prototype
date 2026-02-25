# Notification Trigger

A simple toy platform to send push notifications via **APNS** (iOS) and **FCM** (Android). Accepts a common payload structure and routes to the appropriate service based on platform.

## Quick start

```bash
pnpm install
pnpm dev
```

Open http://localhost:3998 to use the web UI.

## API

### POST /api/send

Send a push notification.

**Request body:**

```json
{
  "token": "<APNS or FCM device token>",
  "platform": "ios" | "android" | null,
  "payload": {
    "title": "Hello",
    "body": "Notification body",
    "subtitle": "Optional subtitle",
    "data": { "key": "value" },
    "sound": "default",
    "badge": 1,
    "clickAction": "category-id"
  }
}
```

- **token**: APNS device token (iOS) or FCM registration token (Android)
- **platform**: Optional. If omitted, auto-detected from token format (64 hex chars → iOS/APNS, else → Android/FCM)
- **payload**: Common structure; `title` and `body` are required. `data` values must be strings for FCM compatibility.

**Example (curl):**

```bash
curl -X POST http://localhost:3998/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_DEVICE_TOKEN",
    "payload": {
      "title": "Test",
      "body": "Hello from notification trigger"
    }
  }'
```

## Environment

| Variable | Description |
|----------|-------------|
| `NOTIFICATION_TRIGGER_PORT` | Server port (default: 3998) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (for FCM) |
| `APNS_KEY_PATH` | Path to .p8 APNS auth key |
| `APNS_KEY_ID` | APNS key ID |
| `APNS_TEAM_ID` | Apple team ID |
| `APNS_BUNDLE_ID` | App bundle ID |
| `APNS_PRODUCTION` | `true` for production APNS |

Load from project root `.env` (or set in shell).
