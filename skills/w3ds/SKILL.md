---
name: w3ds
description: "Use when the user is building on Web 3 Data Spaces (W3DS) or the MetaState prototype — building a post-platform, integrating an eVault, calling the eVault GraphQL API (createMetaEnvelope, updateMetaEnvelope, removeMetaEnvelope, bulkCreateMetaEnvelopes, uploadFile, bindingDocument*), wiring the Web3 Adapter, writing a webhook controller for /api/webhook, authoring mapping.json files, using the wallet-sdk, implementing the w3ds://auth or w3ds://sign flow, resolving W3IDs / eNames via the Registry, working with the Ontology service, dealing with Binding Documents, dereferencing w3ds://file URIs, provisioning an eVault, syncing public keys, or debugging local dev (Registry, Provisioner, eVault-core, Dev Sandbox, pnpm dev:core). Also use when the user asks what an eVault, W3ID, eName, MetaEnvelope, Envelope, Ontology, Web3 Adapter, Awareness Protocol, or Awareness-as-a-Service is."
license: Apache 2.0
---

# W3DS — Web 3 Data Spaces

W3DS lets users own their data in a personal **eVault** while platforms act as interchangeable frontends. Data written on one platform automatically syncs to every other registered platform via the **Awareness Protocol**. This skill is for developers building on W3DS: integrating platforms, calling the eVault GraphQL API, wiring the Web3 Adapter, and debugging local dev.

## Ecosystem map

The "digital self" is a triad: **eName + eID certificate + eVault**. Users hold keys in the **eID Wallet**. The **Provisioner** creates their eVault. The **Registry** resolves W3IDs to eVault URLs and hosts the platform directory. The **Ontology** service publishes JSON Schemas that platforms map their local schemas to. A **Web3 Adapter** on each platform bridges the local DB to the owner's eVault. When data changes, eVault fires the **Awareness Protocol** to notify every other registered platform.

## Components

| Component | One line | Load this reference |
|---|---|---|
| **eVault** | GraphQL data store per W3ID, Neo4j-backed, delivers webhooks on writes | [reference/evault.md](reference/evault.md) |
| **W3ID / eName** | UUID-based persistent identifier; eName = W3ID registered in Registry | [reference/identity.md](reference/identity.md) |
| **Binding Document** | Signed MetaEnvelope tying a user to an eName (id_document, photograph, social_connection, self) | [reference/identity.md](reference/identity.md) |
| **Registry** | W3ID resolution, `/entropy` for provisioning, JWKS, platform list, key-binding certs (temporary) | [reference/registry.md](reference/registry.md) |
| **Ontology** | JSON Schema draft-07 registry served at `/schemas` and `/schemas/:id` | [reference/registry.md](reference/registry.md) |
| **Provisioner** | Creates new eVaults; exposes `POST /provision` | [reference/wallet.md](reference/wallet.md) |
| **eID Wallet** | Mobile app (Tauri/SvelteKit); holds ECDSA P-256 keys in Secure Enclave / HSM | [reference/wallet.md](reference/wallet.md) |
| **wallet-sdk** | TypeScript SDK: `provision`, `authenticate`, `syncPublicKeyToEvault`; crypto-agnostic via `CryptoAdapter` | [reference/wallet.md](reference/wallet.md) |
| **Web3 Adapter** | Bridge on each platform between local DB and eVault; `handleChange` outbound, `fromGlobal` inbound | [reference/platform.md](reference/platform.md) |
| **Awareness Protocol** | eVault → `POST /api/webhook` on every other platform after writes | [reference/protocols.md](reference/protocols.md) |
| **w3ds://auth** | Session-signing authentication flow | [reference/protocols.md](reference/protocols.md) |
| **w3ds://sign** | Session-signing for arbitrary payloads (documents, votes, references) | [reference/protocols.md](reference/protocols.md) |
| **w3ds://file** | URI scheme for file blobs; format `w3ds://file?id=@<ename>/<meta-envelope-id>` | [reference/protocols.md](reference/protocols.md) |
| **AaaS** | Awareness-as-a-Service — production-grade replacement for eVault's direct webhook fanout | [reference/protocols.md](reference/protocols.md) |

## Production URLs

| Service | URL |
|---|---|
| Provisioner | `https://provisioner.w3ds.metastate.foundation` |
| Registry | `https://registry.w3ds.metastate.foundation` |
| Ontology | `https://ontology.w3ds.metastate.foundation` |

Source: `docs/docs/W3DS Basics/Links.md`.

## Routing rules

When answering a user's question, load the reference file(s) below **before** writing any code or configuration. Do not fabricate ontology IDs, GraphQL field names, mapping directives, or endpoint paths from memory — grep `docs/docs/` if a reference file doesn't answer the question.

| User question mentions... | Load |
|---|---|
| webhook controller, mapping.json, `handleChange`, `fromGlobal`, `toGlobal`, Web3 Adapter, `ownerEnamePath`, `__date`, `__calc`, `__file`, "how do I build a platform" | [reference/platform.md](reference/platform.md) |
| GraphQL, `createMetaEnvelope`, `updateMetaEnvelope`, `removeMetaEnvelope`, `bulkCreateMetaEnvelopes`, `uploadFile`, `metaEnvelope(id)`, `metaEnvelopes`, ACL, `X-ENAME`, `/whois`, `/logs`, MetaEnvelope, Envelope, Neo4j model | [reference/evault.md](reference/evault.md) |
| W3ID, eName, `@<UUID>` format, X-ENAME header, Binding Document, id_document, photograph, social_connection, self, key rotation, friend-based recovery | [reference/identity.md](reference/identity.md) |
| Registry, `/resolve`, `/entropy`, `/list`, JWKS, key binding certificate, ontology ID for User / Post / Group / Ledger / Currency / Account / Binding / File, `/schemas` | [reference/registry.md](reference/registry.md) |
| w3ds://auth, w3ds://sign, Awareness Protocol packet, signature verification, ECDSA P-256, multibase, base58btc, base64 signature format, `verifySignature`, AaaS, w3ds://file URI, dereferencing files | [reference/protocols.md](reference/protocols.md) |
| eID Wallet, wallet-sdk, `provision`, `authenticate`, `syncPublicKeyToEvault`, `CryptoAdapter`, hardware vs software keys, `PATCH /public-key`, key delegation across devices | [reference/wallet.md](reference/wallet.md) |
| `pnpm dev:core`, Dev Sandbox, ports (4321 / 3001 / 4000 / 8080), `REGISTRY_ENTROPY_KEY_JWK`, `pnpm generate-entropy-jwk`, "webhook not firing", "signature verification fails", "duplicate entities" | [reference/dev-setup.md](reference/dev-setup.md) |

If the question spans multiple topics (common for platform builds), load the two or three most relevant references in one turn rather than piecemeal.

## Do not guess

The docs are ground truth. Any of these values, if guessed, is almost certainly wrong:

- **Ontology UUIDs** — memorized table lives in [reference/registry.md](reference/registry.md). `w3ds-file-v1` is a **string literal**, not a UUID.
- **GraphQL field / mutation names** — `createMetaEnvelope` is the idiomatic name; `storeMetaEnvelope` is a legacy alias still used internally by the Web3 Adapter's `EVaultClient`. Full signatures live in [reference/evault.md](reference/evault.md).
- **Mapping directive syntax** — `__date(...)`, `__calc(...)`, `__file(...)`, `tableName(path),globalAlias`, and array `users(participants[].id),participantIds` — verbatim examples in [reference/platform.md](reference/platform.md).
- **Signature encoding** — software keys emit base64 raw 64-byte (r || s); hardware keys emit multibase base58btc (`z...`). See [reference/protocols.md](reference/protocols.md).
- **Endpoint paths and headers** — every eVault request needs `X-ENAME: @<ename>`. The `/provision` endpoint lives on the Provisioner, not eVault-core (though in local dev they run in the same eVault-core process on port 3001).

If uncertain, `grep -r <symbol> docs/docs/` before writing the answer.

## Terminology anchors

Common confusion points — internalize these once:

- **MetaEnvelope vs Envelope**: MetaEnvelope is the top-level entity (one post, one user). Envelope is a single field of that entity, stored as its own Neo4j node linked via `LINKS_TO`.
- **W3ID vs eName**: All eNames are W3IDs. Only W3IDs registered in the Registry are eNames (resolvable). Both use the `@<UUID>` format when global.
- **Ontology vs schema**: "Ontology" in this ecosystem refers to a specific JSON Schema published by the Ontology service and referenced by its schemaId (a W3ID). Do not confuse with generic "ontology" from semantic web.
- **Platform vs post-platform**: A platform participates in W3DS via a Web3 Adapter and a `/api/webhook` endpoint. A post-platform is a platform that operates in "dataless" mode — it doesn't own the data, users' eVaults do.
- **`w3ds-file-v1` vs `File` ontology**: `w3ds-file-v1` is the low-level storage envelope created by `uploadFile` for blob dereferencing. The `File` ontology (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`) is a higher-level platform record for file-manager / esigner style apps. They are not interchangeable — different field names, different layer. Detail in [reference/protocols.md](reference/protocols.md).
- **Awareness Protocol vs AaaS**: Awareness Protocol is the prototype-level fire-and-forget fanout from eVault-core. Awareness-as-a-Service (AaaS) is the production-grade replacement with subscriptions, persistence, retries, and a dead-letter queue.
- **`storeMetaEnvelope` / `updateMetaEnvelopeById`**: Legacy GraphQL mutation names, still used internally by the Web3 Adapter's `EVaultClient`. External integrations should use `createMetaEnvelope` / `updateMetaEnvelope` / `removeMetaEnvelope` instead.

## Working style

- Always resolve the eVault URL for a user via the Registry before hitting `/graphql` or `/whois`. Do not hardcode eVault URLs.
- Every GraphQL and HTTP call to eVault needs `X-ENAME`. Missing this header is the most common cause of 400s.
- ACLs in the prototype are all-or-nothing except for `["*"]`. There is no read-only-without-write yet.
- Webhook delivery is fire-and-forget and prototype-level: no retries, no ordering, no at-least-once. Design your platform's webhook controller to be **idempotent** on global `id`.
- After `storeMetaEnvelope` there is a 3-second delay before webhook fanout to prevent ping-pong. `updateMetaEnvelopeById` fanout is immediate.
- If the user is running things locally, refer them to [reference/dev-setup.md](reference/dev-setup.md) before troubleshooting — most sync bugs come from a service that isn't running or a missing env var.
