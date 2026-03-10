# Notification Trigger

A standalone toy platform to send push notifications via **APNS** (iOS) and **FCM** (Android). Accepts a common payload structure and routes to the appropriate service based on platform.

Kept in this repo for testing purposes. Can be moved to its own project for standalone use.

## Quick start

```bash
pnpm install
cp .env.example .env
# Edit .env with your credentials
pnpm dev
```

Open http://localhost:3998 to use the web UI.

## Requirements

- **Node.js** 18+
- **FCM (Android)**: Firebase service account JSON
- **APNS (iOS)**: Apple .p8 auth key + key ID, team ID, bundle ID

You can run with only one provider configured; the other will be disabled.

## API

### GET /api/health

Returns health status and which providers are configured.

```json
{
  "ok": true,
  "apns": true,
  "fcm": true
}
```

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

Copy `.env.example` to `.env` and fill in your credentials. See `.env.example` for all required variables.

| Variable | Required | Description |
|----------|----------|--------------|
| `NOTIFICATION_TRIGGER_PORT` | No | Server port (default: 3998) |
| `GOOGLE_APPLICATION_CREDENTIALS` | For FCM | Path to Firebase service account JSON |
| `APNS_KEY_PATH` | For APNS | Path to .p8 APNS auth key |
| `APNS_KEY_ID` | For APNS | APNS key ID |
| `APNS_TEAM_ID` | For APNS | Apple team ID |
| `APNS_BUNDLE_ID` | For APNS | App bundle ID |
| `APNS_PRODUCTION` | No | `true` for production APNS (default: `false`) |
| `APNS_BROADCAST_CHANNEL_ID` | No | Base64 channel ID for Live Activities (optional) |

## Build & run

```bash
pnpm build
pnpm start
```

## Integration with this repo

When used from the prototype monorepo:

- Control panel uses `NOTIFICATION_TRIGGER_URL` (e.g. `http://localhost:3998`) to send notifications
- The provisioner (evault-core) stores device tokens; the control panel fetches them and sends via this service
