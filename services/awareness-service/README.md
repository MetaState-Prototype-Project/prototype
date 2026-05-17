# Awareness as a Service (AaaS)

AaaS is the single fanout point for MetaEnvelope awareness packets. It replaces
evault-core's built-in webhook fanout: evault-core now makes one POST to
`AWARENESS_SERVICE_URL/ingest` per change, and AaaS owns persistence, polling,
subscription matching and retrying webhook delivery.

## Packages

- `api/` — Express + TypeORM (Postgres) service.
- `portal/` — SvelteKit + Tailwind public portal.

## What it does

1. **Ingest** — `POST /ingest` receives every awareness packet from evault-core
   (shared-secret auth) and persists it.
2. **Poll** — `GET /api/packets` lets approved consumers query packet history by
   ontology, eVault and time range, with cursor pagination.
3. **Subscribe** — `/api/subscriptions` registers webhook subscriptions filtered
   by ontology and eVault. Delivered payloads match the legacy evault-core
   webhook format exactly.
4. **Deliver** — a background engine drains the delivery queue with exponential
   backoff; exhausted deliveries land in a dead-letter table.
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

# 4. Start the API (also seeds catch-all subscriptions on launch)
pnpm --filter awareness-service-api dev

# 5. Start the portal
pnpm --filter awareness-portal dev
```

Then set `AWARENESS_SERVICE_URL` and `AWARENESS_INGEST_SECRET` for evault-core
so it forwards packets here.

## Backward compatibility

On launch AaaS seeds a catch-all subscription for every platform currently in
the registry, so existing webhook receivers keep getting every packet at
`<platform>/api/webhook` with no change. Consumers can later narrow to specific
ontologies / eVaults.
