---
sidebar_position: 1
---

# Awareness as a Service (AaaS)

Awareness as a Service is the single fanout point for MetaEnvelope **awareness
packets**. It replaces the webhook fanout that previously lived inside
evault-core, and adds a queryable history, granular subscriptions, and an
access-controlled public portal.

## Why it exists

Before AaaS, every eVault fanned out webhooks itself: on each MetaEnvelope
create/update it queried the registry for every platform and POSTed the change
to all of them. That design had three problems:

- **Undifferentiated** — every platform received every packet, regardless of
  whether it cared about that ontology.
- **Unqueryable** — there was no way to poll history or catch up after
  downtime; a missed webhook was simply lost.
- **Ungoverned** — any registered platform received everything; there was no
  access gate.

AaaS fixes all three. evault-core now makes **one** POST per change to
`AWARENESS_SERVICE_URL/ingest`, and AaaS owns persistence, polling, subscription
matching, and retrying delivery.

## Architecture

```
                         ┌─────────────────────────────┐
   evault-core ──POST───▶ │  AaaS  /ingest              │
   (per change)           │   • persist packet          │
                          │   • match subscriptions     │
                          │   • queue deliveries        │
                          └──────────────┬──────────────┘
                                         │
            ┌────────────────────────────┼───────────────────────────┐
            ▼                            ▼                           ▼
   GET /api/packets            Delivery engine             Portal (SvelteKit)
   (poll by ontology /         (retry + backoff,            • W3DS login
    eVault / time range)        dead-letter)                • apply for access
                               POST <subscriber>/api/webhook • admin approval
```

The API is **Express + TypeORM + Postgres**; the portal is **SvelteKit +
Tailwind**. Both live in `services/awareness-service/`.

## Awareness packet format

The packet evault-core POSTs to `/ingest` — and the body AaaS delivers to
webhook subscribers — is unchanged from the legacy evault-core webhook, so
existing receivers need no changes:

```json
{
  "id": "<MetaEnvelope id>",
  "w3id": "<owner eName>",
  "evaultPublicKey": "<eVault public key>",
  "data": { "...": "the MetaEnvelope payload" },
  "schemaId": "<ontology>"
}
```

`/ingest` additionally accepts a `requestingPlatform` field, used only to skip
delivering a packet back to its origin (the ping-pong guard the old fanout
enforced). It is never persisted or delivered.

## Capabilities

### 1. Polling query API

`GET /api/packets` lets an approved consumer query the awareness history,
filtered by `ontology` (comma-separated), `evault`, and a `from`/`to` time
range. Results are ordered by receive time and paged with an opaque cursor:

```
GET /api/packets?ontology=<schemaId>&from=2026-05-01T00:00:00Z&limit=100
Authorization: Bearer aaas_<api-key>
```

The response carries `packets`, `hasMore`, and `nextCursor` — pass `nextCursor`
back as `cursor` to page forward.

### 2. Dynamic webhook subscriptions

`POST /api/subscriptions` registers a webhook subscription scoped by ontology
and eVault. Empty filter arrays mean "everything":

```json
{
  "targetUrl": "https://my-platform.example/api/webhook",
  "ontologyFilter": ["<ontology-A>", "<ontology-B>"],
  "evaultFilter": ["<eName-or-public-key>"]
}
```

A consumer manages only its own subscriptions (`GET`, `PATCH`, `DELETE`). If a
subscription has a `secret`, each delivery carries an `x-aaas-signature` header
(HMAC-SHA256 of the body).

### 3. Retrying delivery + dead-letters

A background engine drains the delivery queue. Failed deliveries are retried
with exponential backoff (30s → 1m → 2m → 5m → 15m → 1h → 6h → 24h). After
`AWARENESS_MAX_ATTEMPTS` attempts the delivery is moved to a **dead-letter**
table, visible to admins in the portal, where it can be replayed.

### 4. Public access portal

Platforms log in with **W3DS** (scan a `w3ds://auth` deeplink with the eID
wallet), submit an access application, and wait for an admin to approve it.
Admins are identified by an env-var allowlist of eNames (`AAAS_ADMIN_ENAMES`).
Once approved, a consumer issues API keys from its dashboard and manages
subscriptions and delivery status there.

## Authentication

| Surface | Credential |
| --- | --- |
| `/ingest` | `x-ingest-secret` header (shared with evault-core) |
| `/api/packets`, `/api/subscriptions`, `/api/me/*` | `Authorization: Bearer` — an issued API key (`aaas_…`) **or** a W3DS portal session JWT |
| `/api/applications/*` | W3DS portal session JWT |
| `/api/admin/*` | W3DS portal session JWT whose eName is in `AAAS_ADMIN_ENAMES` |

API keys are stored only as SHA-256 hashes; the plaintext is shown exactly once
on creation.

## API reference

The API serves an interactive **Scalar** reference and a raw OpenAPI document:

- `GET /docs` — Scalar API reference UI
- `GET /openapi.json` — the OpenAPI 3.1 document

## Migration from the old fanout

AaaS is designed to be dropped in with **zero receiver-side changes**:

1. **Backfill.** AaaS runs on the same node as evault-core's Neo4j. The
   `backfill` script reads existing MetaEnvelopes straight from the graph and
   seeds the `packets` table (history only — it does not queue deliveries).
2. **Catch-all seeding.** On every launch, AaaS ensures each platform currently
   in the registry has an approved consumer and a catch-all subscription
   pointing at `<platform>/api/webhook`. Existing platforms therefore keep
   receiving every packet exactly as before, and can later narrow their
   subscriptions to specific ontologies or eVaults.
3. **evault-core switch.** evault-core's `deliverWebhooks`/`getActivePlatforms`
   are removed; a single `notifyAwareness` POST forwards each packet to AaaS.

## Configuration

| Variable | Purpose |
| --- | --- |
| `AWARENESS_DATABASE_URL` | Postgres connection string for AaaS |
| `AWARENESS_API_PORT` | API listen port (default 4100) |
| `AWARENESS_PUBLIC_URL` | Public base URL, used for W3DS auth callbacks |
| `AWARENESS_INGEST_SECRET` | Shared secret for `/ingest` |
| `AWARENESS_SERVICE_URL` | (evault-core) where to POST packets |
| `AAAS_ADMIN_ENAMES` | Comma-separated admin eNames |
| `AAAS_JWT_SECRET` | Signs portal session JWTs |
| `AWARENESS_MAX_ATTEMPTS` | Delivery attempts before dead-lettering (default 8) |
| `AWARENESS_DELIVERY_POLL_MS` | Delivery engine poll interval (default 2000) |
| `AWARENESS_NEO4J_URI` / `_USER` / `_PASSWORD` | Neo4j source for the backfill |
| `PUBLIC_AWARENESS_API_URL` | (portal) AaaS API base URL |

## Running locally

```sh
# Create the Postgres database, then:
pnpm --filter awareness-service-api build
pnpm --filter awareness-service-api migration:run
pnpm --filter awareness-service-api backfill        # one-time, from Neo4j
pnpm --filter awareness-service-api dev             # API (seeds catch-all on launch)
pnpm --filter awareness-portal dev                  # portal
```
