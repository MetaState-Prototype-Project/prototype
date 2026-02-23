# Trust Score Service

Algorithmic Trust Service that produces a deterministic numeric score from **0 to 10** for any user.

## Formula

| Component                      | Points |
| ------------------------------ | ------ |
| Unverified baseline            | 0      |
| Account age > 180 days         | 1      |
| Key location = TPM             | 1      |
| Key location = SW              | 0      |
| 3rd-degree connections < 10    | 0      |
| 3rd-degree connections 10–24   | 0.5    |
| 3rd-degree connections 25–99   | 1      |
| 3rd-degree connections 100–249 | 2      |
| 3rd-degree connections 250–499 | 3      |
| 3rd-degree connections 500+    | 4      |
| KYC / ID verified              | 4      |

**Max score = 10** (1 + 1 + 4 + 4)

## Running

```bash
# Install dependencies (from monorepo root)
pnpm install

# Dev mode with auto-reload
pnpm --filter trust-score dev

# Production
pnpm --filter trust-score start
```

Default port: **3005** (override with `PORT` env var).

## API

### `GET /trust-score/:eName` (primary endpoint)

Fetch the trust score for a user by their eName (W3ID). The service fetches all required data automatically.

```bash
GET /trust-score/julien.w3id
```

Response:

```json
{
    "eName": "julien.w3id",
    "score": 8,
    "breakdown": {
        "verification": 4,
        "accountAge": 1,
        "keyLocation": 1,
        "socialConnections": 2
    }
}
```

> **Note:** Data fetching is currently mocked. Each function in `src/userDataService.js` has TODO comments showing the real API calls to wire in once binding documents are written to the eVault.

### `POST /trust-score` (manual input)

```json
{
    "isVerified": true,
    "accountAgeDays": 200,
    "keyLocation": "TPM",
    "thirdDegreeConnections": 150
}
```

### `GET /trust-score?isVerified=true&accountAgeDays=200&keyLocation=TPM&thirdDegreeConnections=150`

Both return:

```json
{
    "score": 8,
    "breakdown": {
        "verification": 4,
        "accountAge": 1,
        "keyLocation": 1,
        "socialConnections": 2
    }
}
```

### `GET /health`

Returns `{ "status": "ok" }`.

## Testing

```bash
pnpm --filter trust-score test
```
