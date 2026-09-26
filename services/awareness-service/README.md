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
   database operations and exponential backoff for 24 hours, counted from the
   first delivery attempt (or a later admin replay), never from ingest, so time
   spent waiting in a backlog does not consume the retry budget. Failures then
   land in a dead-letter table.
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

`GET /health` never touches the database; it returns 503 `degraded` when this
process's delivery worker has not completed a tick within
`AWARENESS_WORKER_PROGRESS_STALE_MS` (60s) or has failed
`AWARENESS_WORKER_MAX_CONSECUTIVE_FAILURES` (3) ticks in a row. `GET /ready`
verifies Postgres, migration state, and that some worker with a fresh heartbeat
is also making progress (`worker: ok | failing | stale`). `GET /metrics` exposes
queue states, expired leases, oldest active and oldest overdue delivery age,
heartbeat age, last-success age and consecutive failures in Prometheus format.
Queue counts come from partial indexes only, are capped at 10,000 and run under
a 2s statement timeout, so probes never scan delivery history. Deployments must
run migrations before the process starts.

## Operations: deploying delivery-claim changes

`deliveries` keeps every delivered and dead row, so it grows large (millions of
rows). Migration `1790000000000-DeliveryClaimIndexes` builds its indexes with
`CREATE INDEX CONCURRENTLY` (writes are not blocked) and lifts the statement
timeout for that session only; the new columns are metadata-only additions.

1. Start from a clean tree on the host: `git status` in the repo. Reconcile any
   local edits (for example to an already-applied migration) by committing them
   upstream or discarding them before pulling.
2. Pre-check (read-only): `SELECT n_live_tup, n_dead_tup, last_autovacuum FROM
   pg_stat_user_tables WHERE relname = 'deliveries'`, and confirm there are no
   invalid indexes: `SELECT indexrelid::regclass FROM pg_index WHERE indrelid =
   'deliveries'::regclass AND NOT indisvalid`.
3. Build and migrate:
   ```sh
   pnpm install --frozen-lockfile
   rm -rf services/awareness-service/api/dist   # no stale compiled migrations
   pnpm --filter awareness-service-api build
   pnpm --filter awareness-service-api migration:run
   ```
   Watch progress in `pg_stat_progress_create_index`. If the build is
   interrupted, rerun `migration:run`; the migration drops and rebuilds an
   invalid leftover index.
4. Restart the process running `dist/index.js` (it refuses to start with pending
   migrations).
5. Run `VACUUM (ANALYZE) deliveries` (non-blocking) so the planner has fresh
   statistics and the stream-order lookups can use the visibility map.
6. Verify: no `delivery tick failed` log lines; `/ready` shows `worker: ok` and
   `consecutiveFailures: 0`; `aaas_oldest_due_seconds` falls. Check the claim
   plan with plain `EXPLAIN` (no `ANALYZE`, which would claim rows): it should
   use `idx_deliveries_claim_due` and `idx_deliveries_expired_lease`, not
   `idx_deliveries_next_attempt`.

Receiver-side failures (HTTP 4xx/5xx, TLS alerts, certificate hostname
mismatches) are reported per delivery and retried for the window above; they
are not fixed by any of this. Do not disable TLS verification or bulk-replay
dead letters; fix the receiver, then replay individually.

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
