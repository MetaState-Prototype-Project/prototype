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

AaaS fixes all three. Every eVault mutation now commits an immutable event to a
Neo4j transactional outbox alongside the user's data. The outbox retries
`AWARENESS_SERVICE_URL/ingest` until AaaS atomically commits the event and its
matching deliveries; AaaS then owns polling and retrying subscriber delivery.

## Architecture

```
                         ┌─────────────────────────────┐
   eVault outbox ─POST───▶ │  AaaS  /ingest              │
   (retry-until-ack)       │   • persist immutable event │
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

New producers add `eventId`, `streamVersion`, and `occurredAt`. `eventId` is the
stable idempotency key across outbox retries, while `id` remains the
MetaEnvelope id. These fields are delivered additively to existing receivers.

`/ingest` additionally accepts a `requestingPlatform` field, used to skip
delivering a packet back to its origin (the ping-pong guard the old fanout
enforced). It is retained in immutable event history for audit/reconciliation,
but is not included in subscriber payloads.

### File uploads

The eVault `uploadFile` mutation emits a packet like any other write, stamped
`schemaId: "w3ds-file-v1"` with the storage payload (`filename`, `contentType`,
`size`, `blobKey`, `publicUrl`, `uploadedAt`) as `data`. Subscribe to it to
observe uploads rather than mirroring each blob as a second `File`-ontology
envelope.

`w3ds-file-v1` is a **slug, not a UUID** — `ontologyFilter` and the
`?ontology=` query parameter match ontologies as opaque strings, so it must be
given verbatim.

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

Because catch-all subscriptions receive every ontology, a receiver **must ack
packets it does not consume with a 200**. All non-2xx responses remain retryable
for the 24-hour window, after which the event is dead-lettered and alerted.

### 3. Retrying delivery + dead-letters

A lease-based worker drains the delivery queue. Every Postgres operation and
batch has a deadline, so a poisoned connection cannot permanently wedge the
polling loop. Failed deliveries use jittered exponential backoff for 24 hours;
expired leases are reclaimed after crashes. After the retry window the delivery
moves to a **dead-letter** table, visible to admins in the portal for replay.

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
   seeds both immutable query history and the latest-state projection. It does
   not queue deliveries.
2. **Catch-all reconciliation.** On every launch and once per configured sync
   interval, AaaS ensures each platform currently in the registry has an
   approved consumer and an active catch-all subscription pointing at
   `<platform>/api/webhook`. Existing and newly registered platforms therefore
   keep receiving every packet exactly as before.
3. **eVault transactional outbox.** Every mutation and its awareness event
   commit together in Neo4j. A dispatcher retries ingestion until AaaS returns a
   durable acknowledgement, including across eVault and AaaS restarts.

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
| `AWARENESS_DELIVERY_POLL_MS` | Delivery engine poll interval (default 2000) |
| `AWARENESS_DELIVERY_LEASE_MS` | Expiring worker lease duration (default 30000) |
| `AWARENESS_DELIVERY_BATCH_TIMEOUT_MS` | Hard batch deadline (default 25000) |
| `AWARENESS_DELIVERY_RETRY_WINDOW_MS` | Subscriber retry window (default 24 hours) |
| `AWARENESS_DB_STATEMENT_TIMEOUT_MS` / `AWARENESS_DB_QUERY_TIMEOUT_MS` / `AWARENESS_DB_LOCK_TIMEOUT_MS` | Postgres anti-wedge deadlines |
| `AWARENESS_OUTBOX_POLL_MS` / `AWARENESS_OUTBOX_LEASE_MS` / `AWARENESS_OUTBOX_DB_TIMEOUT_MS` / `AWARENESS_OUTBOX_RETENTION_MS` | Durable eVault outbox tuning |
| `AWARENESS_REGISTRY_SYNC_MS` | Registry catch-all reconciliation interval (default 60000; 0 disables periodic sync) |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | Standard eVault Neo4j vars — reused by the one-time backfill |
| `PUBLIC_AWARENESS_API_URL` | (portal) AaaS API base URL |

## Running locally

```sh
# Create the Postgres database, then:
pnpm --filter awareness-service-api build
pnpm --filter awareness-service-api migration:run
pnpm --filter awareness-service-api backfill        # one-time, from Neo4j
pnpm --filter awareness-service-api dev # API + worker in one process
pnpm --filter awareness-portal dev                  # portal
```
