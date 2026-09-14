# Awareness as a Service (AaaS)

AaaS is the single fanout point for MetaEnvelope awareness packets. It replaces
evault-core's built-in webhook fanout: evault-core now makes one POST to
`AWARENESS_SERVICE_URL/ingest` per change, and AaaS owns persistence, polling,
subscription matching and retrying webhook delivery.

## Packages

- `api/` — Express + TypeORM (Postgres) service.
- `portal/` — SvelteKit + Tailwind public portal.

## What it does

1. **Ingest** — eVault's transactional Neo4j outbox retries `POST /ingest` until
   AaaS atomically persists the immutable event and all matching deliveries.
2. **Poll** — `GET /api/packets` lets approved consumers query packet history by
   ontology, eVault and time range, with cursor pagination. A single packet can
   also be fetched directly by its MetaEnvelope id with `GET /api/packets/:id`.
3. **Subscribe** — `/api/subscriptions` registers webhook subscriptions filtered
   by ontology and eVault. Delivered payloads preserve the legacy evault-core
   fields and add event identity, operation, version, and timestamp metadata.
4. **Deliver** — a lease-based background worker drains the queue with bounded
   database operations and exponential backoff for 24 hours; failures then land
   in a dead-letter table.
5. **Portal** — platforms log in with W3DS, apply for access, and admins
   (`AAAS_ADMIN_ENAMES`) approve them. Approved consumers get API keys.

## Setup

```sh
# 1. Create the Postgres database referenced by AWARENESS_DATABASE_URL
# 2. Run migrations
pnpm --filter awareness-service-api build
pnpm --filter awareness-service-api migration:run

# 3. One-time backfill from evault-core's Neo4j (same node)
pnpm --filter awareness-service-api backfill

# 4. Start AaaS. The API and delivery worker run in this one process.
pnpm --filter awareness-service-api dev

# Production:
pnpm --filter awareness-service-api start

# 5. Start the portal
pnpm --filter awareness-portal dev
```

Then set `AWARENESS_SERVICE_URL` and `AWARENESS_INGEST_SECRET` for evault-core
so it forwards packets here.

`GET /ready` verifies Postgres, migration state, and worker heartbeat. `GET
/metrics` exposes queue age, queue states, expired leases, and heartbeat age in
Prometheus format. Deployments must run migrations before either process starts.

## API documentation

The running API serves an interactive [Scalar](https://github.com/scalar/scalar)
reference and a raw OpenAPI 3.1 document:

- `GET /docs` — Scalar API reference UI
- `GET /openapi.json` — OpenAPI 3.1 document

A prose overview lives in the docs site under **Services → Awareness as a
Service**.

## Backward compatibility

On launch and periodically thereafter, AaaS reconciles a catch-all subscription
for every platform currently in the registry, so existing and newly registered
webhook receivers keep getting every packet at `<platform>/api/webhook` with no
change. `AWARENESS_REGISTRY_SYNC_MS` controls the interval (default 60000; set
to 0 to disable periodic reconciliation). A repaired or newly created catch-all
also receives the previous 24 hours, closing the registry-sync race.
Non-registry consumers can narrow their own subscriptions to specific
ontologies / eVaults.
