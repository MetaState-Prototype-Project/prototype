---
sidebar_position: 4
---

# Awareness Protocol

:::info Delivery guarantee
Awareness delivery is durable and **at least once**. Receivers must deduplicate
on `eventId`; the same event can be sent again after a timeout or worker crash.
:::

The Awareness Protocol is the webhook delivery mechanism in W3DS. When data in an [eVault](/docs/Infrastructure/eVault) changes, the mutation atomically creates an awareness outbox event. [Awareness as a Service](/docs/Services/Awareness-as-a-Service) (AaaS) persists that immutable event and delivers it to matching subscriptions.

## Overview

Platforms can receive changes by webhook or poll AaaS history. Compatibility subscriptions send every change to each registered platform's `/api/webhook` endpoint except the platform that originated the change. Granular consumers can instead subscribe by ontology and eVault.

### Key Properties

- **Transactional source capture**: User data and its source outbox event commit together in Neo4j.
- **At-least-once delivery**: eVault retries ingestion until AaaS acknowledges it; AaaS retries subscribers with backoff for 24 hours.
- **Restart-safe**: Pending work and expiring worker leases live in Neo4j/Postgres, not process memory.
- **Ordered per stream**: Events for one subscription and MetaEnvelope are delivered in source order; unrelated streams run concurrently.
- **Requestor excluded**: The platform that made the GraphQL request (store/update) is excluded from the list of recipients to avoid "webhook ping-pong."

## When the Protocol Runs

An awareness event is committed by:

1. **[storeMetaEnvelope](/docs/Infrastructure/eVault#graphql-api)** and bulk/file/binding-document creates.
2. **[updateMetaEnvelopeById](/docs/Infrastructure/eVault#graphql-api)** and individual envelope updates.
3. **deleteMetaEnvelope**, as a tombstone with `operation: "delete"` and `data: null`.

## Mechanism

```mermaid
sequenceDiagram
    participant PlatformA as Platform A
    participant EVault as eVault Core
    participant AaaS as AaaS
    participant PlatformB as Platform B
    participant PlatformC as Platform C

    PlatformA->>EVault: storeMetaEnvelope / updateMetaEnvelopeById
    EVault->>EVault: Atomically persist data + outbox event
    EVault->>AaaS: POST /ingest (retry until acknowledged)
    AaaS->>AaaS: Atomically persist event + delivery rows
    AaaS->>PlatformB: POST /api/webhook
    AaaS->>PlatformC: POST /api/webhook
    Note over AaaS,PlatformC: Retry non-2xx/timeouts for 24h; then dead-letter
```

### Step-by-Step

1. **Capture**: eVault stores the data mutation and immutable `AwarenessOutbox` event in one Neo4j transaction.
2. **Ingest**: The eVault dispatcher sends the event to AaaS. Network and service failures remain queued across restarts and retry until acknowledged.
3. **Match**: AaaS atomically stores the immutable event, updates its latest-state projection, and queues every matching subscription. The requesting platform is excluded by normalized origin.
4. **Deliver**: Lease-based workers POST to subscribers concurrently across independent streams. Timeouts and every non-2xx response retry with jittered backoff for 24 hours, then move to the dead-letter queue for replay.

## Packet Format (Awareness Protocol Payload)

The body of each webhook request is JSON with the following fields:

| Field | Description |
|-------|-------------|
| `eventId` | Stable, globally unique idempotency key for this mutation event. |
| `id` | MetaEnvelope ID (W3ID). |
| `w3id` | Owner eName (eVault owner W3ID). |
| `evaultPublicKey` | Public key of the source eVault, when available. |
| `schemaId` | [Ontology](/docs/Infrastructure/Ontology) schema W3ID (identifies the type of entity and which mapping the platform should use). |
| `data` | Full entity payload in the **global ontology** shape, or `null` for a delete tombstone. |
| `operation` | `create`, `update`, or `delete`. |
| `streamVersion` | Monotonic version within this MetaEnvelope's event stream. |
| `occurredAt` | Source mutation timestamp in ISO-8601 format. |

In the current version of the implementation the entire payload is sent in
plain text to any registered platform, so all data is sent to every platform and
it's the platform's responsibility to reject any packets it doesn't use, in
future versions of awareness protocol, it will be changed so that platforms can
subscribe to certain ontology changes and they will be provided details of the
updated MetaEnvelope by reference instead of value.

**Content-Type**: `application/json`

**Example**:

```json
{
  "eventId": "7fd6c06c-80ae-4137-9d62-c15af53f92cf",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "w3id": "@e4d909c2-5d2f-4a7d-9473-b34b6c0f1a5a",
  "schemaId": "550e8400-e29b-41d4-a716-446655440001",
  "data": {
    "content": "Hello, world!",
    "mediaUrls": [],
    "authorId": "@e4d909c2-5d2f-4a7d-9473-b34b6c0f1a5a",
    "createdAt": "2025-01-24T10:00:00Z"
  },
  "operation": "update",
  "streamVersion": 4,
  "occurredAt": "2026-09-15T03:00:00.000Z"
}
```

## Platform Contract

Platforms that participate in W3DS must implement an HTTP endpoint that accepts awareness protocol packets:

- **Method and path**: `POST /api/webhook`
- **Request**: JSON body as described above.
- **Behavior**: The platform should (1) use `schemaId` to find the correct mapping from global ontology to local schema, (2) transform `data` from global to local format (e.g. using the [Web3 Adapter](/docs/Infrastructure/Web3-Adapter#fromglobal)'s `fromGlobal`), (3) resolve or create the local entity and store the global-ID-to-local-ID mapping, (4) return HTTP 200 on success.
- **Idempotency**: Persist processed `eventId` values and acknowledge repeats without applying them twice. Do **not** deduplicate on `id`: create and later updates intentionally share the same MetaEnvelope id.
- **Unknown ontologies**: Delivery is a broadcast — a platform receives packets for ontologies it has no mapping for, such as the `w3ds-file-v1` envelopes emitted by `uploadFile`. Log and **return HTTP 200**; do not return 4xx. AaaS has no 4xx short-circuit, so an error response is retried and then dead-lettered even though nothing was wrong.

For a step-by-step implementation guide, see the [Webhook Controller Guide](/docs/Post%20Platform%20Guide/webhook-controller) in the Post Platform Guide.

## Remaining delivery semantics

- **Duplicates are possible**: At-least-once delivery deliberately prefers a duplicate over a lost event. Receivers own `eventId` deduplication.
- **Automatic retry is bounded downstream**: Subscriber delivery retries for 24 hours, then requires dead-letter replay. Source eVault-to-AaaS ingestion retries without that cutoff.
- **Ordering is stream-local**: One MetaEnvelope is ordered for one subscription. There is intentionally no global order across independent envelopes or subscribers.
- **Registry compatibility remains**: AaaS still reconciles catch-all subscriptions from the Registry for existing platforms; new consumers can use granular subscriptions.

## References

- [eVault](/docs/Infrastructure/eVault) — Webhook delivery and GraphQL API
- [Registry](/docs/Infrastructure/Registry) — Platform list (prototype)
- [Ontology](/docs/Infrastructure/Ontology) — Schema IDs
- [Web3 Adapter](/docs/Infrastructure/Web3-Adapter#fromglobal) — `fromGlobal` and mapping
- [Webhook Controller Guide](/docs/Post%20Platform%20Guide/webhook-controller) — Implementation
