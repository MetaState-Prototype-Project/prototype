---
name: w3ds
description: "Use when the user is building on Web 3 Data Spaces (W3DS) or the MetaState prototype — building a post-platform, integrating an eVault, calling the eVault GraphQL API (createMetaEnvelope, updateMetaEnvelope, removeMetaEnvelope, bulkCreateMetaEnvelopes, uploadFile, bindingDocument*), wiring the Web3 Adapter, writing a webhook controller for /api/webhook, authoring mapping.json files, using the wallet-sdk, implementing the w3ds://auth or w3ds://sign flow, resolving W3IDs / eNames via the Registry, working with the Ontology service, proposing a new ontology, dealing with Binding Documents, dereferencing w3ds://file URIs, provisioning an eVault, syncing public keys, hosting a platform on GitW3 (the W3DS-aware Git forge — `.w3ds/platform.json`, platform eName, version eName, PPA certification, deployment records, porting an existing app, `w3ds-deployment-key.json`), or debugging local dev (Registry, Provisioner, eVault-core, Dev Sandbox, pnpm dev:core). Also use for any design decision about where data lives on a W3DS platform — adding a table, entity, model or field, deciding what to cache locally, or asking whether something belongs in the database or the eVault. Also use when the user asks what an eVault, W3ID, eName, MetaEnvelope, Envelope, Ontology, Web3 Adapter, Awareness Protocol, or Awareness-as-a-Service is."
license: Apache 2.0
---

# W3DS — Web 3 Data Spaces

W3DS lets users own their data in a personal **eVault** while platforms act as interchangeable frontends. Data written on one platform automatically syncs to every other registered platform via the **Awareness Protocol**. This skill is for developers building on W3DS: integrating platforms, calling the eVault GraphQL API, wiring the Web3 Adapter, and debugging local dev.

## Authority

**`https://docs.w3ds.metastate.foundation` is the authoritative source.** This skill is a condensed index of it and can lag behind it. **Where this skill and the docs disagree, the docs win** — say so and follow the docs.

Fetch the docs whenever you are uncertain, and whenever the answer would otherwise come from memory. Every citation in this skill is a live URL, so there is nothing to resolve first.

| Need | Fetch |
|---|---|
| Machine-readable index of every page | `https://docs.w3ds.metastate.foundation/llms.txt` |
| Whole documentation corpus in one file | `https://docs.w3ds.metastate.foundation/llms-full.txt` |
| Latest version of this skill | `https://docs.w3ds.metastate.foundation/skill/SKILL.md` |
| Every ontology and its `schemaId` | `https://ontology.w3ds.metastate.foundation/schemas` |
| Domains, and the schemas under one | `https://ontology.w3ds.metastate.foundation/domains` |

Working inside the `MetaState-Prototype-Project/prototype` checkout? `docs/docs/**` mirrors the site — a convenience, not a second authority.

## Non-negotiables

Read [Data Ownership Rules](https://docs.w3ds.metastate.foundation/docs/W3DS%20Basics/Data-Ownership-Rules) before designing anything. In short:

1. **The eVault is the source of truth. Anything a platform stores is a projection of it.** The docs call platforms "caches and aggregators" — that is permission to keep a fast local copy of data that is authoritative elsewhere, not permission to own it.
2. **Every persisted entity needs three things:** an ontology (`schemaId` resolved, never invented), a resolvable owner (`ownerEnamePath` that resolves for *every* row, to the data subject — not to the platform), and a named write path to that owner's eVault.
3. **A platform lives in a GitW3 repository.** The same instinct one layer up: the repository is the source of truth for the platform metadata W3DS publishes, held in `.w3ds/platform.json` beside the code. Ordinary Git hosting carries the code but not the platform eName, published profile, per-version identities, PPA certificates or deployment records. See [reference/gitw3.md](reference/gitw3.md).
4. **Resolve, never recall.** Ontology IDs, endpoints, GraphQL field names, ACL verbs and eNames are looked up, not remembered. This skill deliberately contains no ontology UUIDs.

A local database is not a violation. A local database that is the only place some user data exists is.

## Pre-flight — before writing any W3DS code

Answer all four. If you cannot, that is the finding — report it instead of writing code around it.

1. **Which ontology?** `GET https://ontology.w3ds.metastate.foundation/schemas`, match on `title`, then confirm the field names with `GET /schemas/:id`. Narrow by subject area first with `GET /domains/:id/schemas`. No match → [Proposing a new ontology](https://docs.w3ds.metastate.foundation/docs/Infrastructure/Ontology#proposing-a-new-ontology). **Never invent a `schemaId`** — it fails silently: the write succeeds, the packet fans out, and every receiving platform drops it for having no matching mapping.
2. **Whose eVault owns it?** Name the `ownerEnamePath` and check it resolves for every row, not the happy path. The owner is the person or group the data is *about*. If it resolves to nothing, `handleChange` returns silently and the entity never syncs.
3. **Truth or projection?** Apply the reconstructability test: *if this database were dropped and rebuilt by replaying the relevant eVaults, what would be lost?* "Nothing that matters" — projection, correct. Anything a user would miss — that data has no home but yours.
4. **What writes it to the eVault?** Point at the call site: the `handleChange` after the local write, or the direct eVault write for a stateless app. "Sync comes later" means the platform owns the data today.

## Stop rules

Stop, state the problem in the user's own terms, propose the eVault-first alternative, and **ask before writing code** when:

- **The design makes the local database authoritative for user data.** A table with no mapping; a field with no ontology counterpart; an entity written locally with no path to any eVault; reads that prefer local rows over eVault-derived state while the eVault is reachable.
- **A persisted entity type has no ontology** and none can be resolved from the Ontology service.

The second is a path, not a wall. Ontologies are ordinary JSON files that anyone can propose: draft the draft-07 schema (fresh random UUIDv4 `schemaId`, a `domain` from `GET /domains`, a `description` per property, `additionalProperties: false`), offer to open the PR against `services/ontology/schemas/`, and say clearly that until it merges the type does not exist. Full procedure in [reference/w3ds-native.md](reference/w3ds-native.md).

These two stops only. Everything else — a missing owner path, an unfamiliar directive, a service that is down — is a normal problem to solve and report, not a reason to halt.

## When you cannot verify

No fetch tool, offline, or the fetch failed? **Proceed, but never present an unverified identifier as confirmed.**

- Name every unverified item in your response, with the exact URL that would settle it.
- Mark it at the call site: `// TODO(w3ds): unverified — confirm against https://ontology.w3ds.metastate.foundation/schemas`.
- Never fill the gap with a plausible-looking UUID, endpoint or field name. A wrong identifier is worse than an obvious placeholder, because it fails silently.

## Definition of done

Before reporting a W3DS task complete, check every line:

- [ ] Every eVault GraphQL and HTTP call sends `X-ENAME: @<ename>`.
- [ ] Every eVault URL came from the Registry at call time — none hardcoded.
- [ ] Every `schemaId` was resolved from the Ontology service in this session, not recalled.
- [ ] Every new entity type has an ontology, a resolving `ownerEnamePath`, and a write path to the owner's eVault.
- [ ] `handleChange` is called after every write to a mapped table — including writes from migrations, seeds, admin paths and background jobs.
- [ ] The webhook controller is idempotent on the global `id`, and returns 200 for ontologies the platform does not consume.
- [ ] Nothing was invented: no UUID, endpoint path, GraphQL field, mapping directive or ACL verb that was not verified — or, if unverifiable, each is flagged in the response and marked in code.
- [ ] The reconstructability test was applied to anything newly persisted, and the answer stated.
- [ ] If the work touched a platform repository: no managed `.w3ds/platform.json` field was hand-edited, no history was rewritten, and no key material was committed.

## Ecosystem map

The "digital self" is a triad: **eName + eID certificate + eVault**. Users hold keys in the **eID Wallet**. The **Provisioner** creates their eVault. The **Registry** resolves W3IDs to eVault URLs and hosts the platform directory. The **Ontology** service publishes JSON Schemas that platforms map their local schemas to. A **Web3 Adapter** on each platform bridges the local DB to the owner's eVault. When data changes, eVault fires the **Awareness Protocol** to notify every other registered platform.

| Component | One line | Load this reference |
|---|---|---|
| **eVault** | GraphQL data store per W3ID, Neo4j-backed, delivers webhooks on writes | [reference/evault.md](reference/evault.md) |
| **W3ID / eName** | UUID-based persistent identifier; eName = W3ID registered in Registry | [reference/identity.md](reference/identity.md) |
| **Binding Document** | Signed MetaEnvelope tying a user to an eName (id_document, photograph, social_connection, self) | [reference/identity.md](reference/identity.md) |
| **Registry** | W3ID resolution, `/entropy` for provisioning, JWKS, platform list, key-binding certs (temporary) | [reference/registry.md](reference/registry.md) |
| **Ontology** | JSON Schema draft-07 registry served at `/schemas`, `/schemas/:id`, `/domains` | [reference/registry.md](reference/registry.md) |
| **Provisioner** | Creates new eVaults; exposes `POST /provision` | [reference/wallet.md](reference/wallet.md) |
| **eID Wallet** | Mobile app (Tauri/SvelteKit); holds ECDSA P-256 keys in Secure Enclave / HSM | [reference/wallet.md](reference/wallet.md) |
| **wallet-sdk** | TypeScript SDK: `provision`, `authenticate`, `syncPublicKeyToEvault`; crypto-agnostic via `CryptoAdapter` | [reference/wallet.md](reference/wallet.md) |
| **Web3 Adapter** | Bridge on each platform between local DB and eVault; `handleChange` outbound, `fromGlobal` inbound | [reference/platform.md](reference/platform.md) |
| **Awareness Protocol** | eVault → `POST /api/webhook` on every other platform after writes | [reference/protocols.md](reference/protocols.md) |
| **w3ds://auth** | Session-signing authentication flow | [reference/protocols.md](reference/protocols.md) |
| **w3ds://sign** | Session-signing for arbitrary payloads (documents, votes, references) | [reference/protocols.md](reference/protocols.md) |
| **w3ds://file** | URI scheme for file blobs; format `w3ds://file?id=@<ename>/<meta-envelope-id>` | [reference/protocols.md](reference/protocols.md) |
| **AaaS** | Awareness-as-a-Service — production-grade replacement for eVault's direct webhook fanout | [reference/protocols.md](reference/protocols.md) |
| **GitW3** | W3DS-aware Git forge; `.w3ds/platform.json`, platform / version / deployment eNames, PPA | [reference/gitw3.md](reference/gitw3.md) |

## Production URLs

| Service | URL |
|---|---|
| Docs (authoritative) | `https://docs.w3ds.metastate.foundation` |
| Provisioner | `https://provisioner.w3ds.metastate.foundation` |
| Registry | `https://registry.w3ds.metastate.foundation` |
| Ontology | `https://ontology.w3ds.metastate.foundation` |
| GitW3 (W3DS-aware Git forge) | `https://git.w3ds.metastate.foundation` |

Source: [Links](https://docs.w3ds.metastate.foundation/docs/W3DS%20Basics/Links).

## Routing rules

Load the reference file(s) below **before** writing any code or configuration.

| User question mentions... | Load |
|---|---|
| "should this live in the database", "add a table / entity / model / field", "how do I model X", caching, local copies, data ownership, "is this W3DS-native", a design or architecture review | [reference/w3ds-native.md](reference/w3ds-native.md) |
| GitW3, `.w3ds/platform.json`, platform eName, version eName, deployment eName, PPA certificate, porting an existing app, `git remote` / tags / releases for a platform, `w3ds-deployment-key.json`, "where do I host this" | [reference/gitw3.md](reference/gitw3.md) |
| webhook controller, mapping.json, `handleChange`, `fromGlobal`, `toGlobal`, Web3 Adapter, `ownerEnamePath`, `__date`, `__calc`, `__file`, "how do I build a platform" | [reference/platform.md](reference/platform.md) |
| GraphQL, `createMetaEnvelope`, `updateMetaEnvelope`, `removeMetaEnvelope`, `bulkCreateMetaEnvelopes`, `uploadFile`, `metaEnvelope(id)`, `metaEnvelopes`, ACL, `X-ENAME`, `/whois`, `/logs`, MetaEnvelope, Envelope, Neo4j model | [reference/evault.md](reference/evault.md) |
| W3ID, eName, `@<UUID>` format, X-ENAME header, Binding Document, id_document, photograph, social_connection, self, key rotation, friend-based recovery | [reference/identity.md](reference/identity.md) |
| Registry, `/resolve`, `/entropy`, `/list`, JWKS, key binding certificate, finding an ontology ID, proposing a new ontology, `/schemas`, `/domains` | [reference/registry.md](reference/registry.md) |
| w3ds://auth, w3ds://sign, Awareness Protocol packet, signature verification, ECDSA P-256, multibase, base58btc, base64 signature format, `verifySignature`, AaaS, w3ds://file URI, dereferencing files | [reference/protocols.md](reference/protocols.md) |
| eID Wallet, wallet-sdk, `provision`, `authenticate`, `syncPublicKeyToEvault`, `CryptoAdapter`, hardware vs software keys, `PATCH /public-key`, key delegation across devices | [reference/wallet.md](reference/wallet.md) |
| `pnpm dev:core`, Dev Sandbox, ports (4321 / 3001 / 4000 / 8080), `REGISTRY_ENTROPY_KEY_JWK`, `pnpm generate-entropy-jwk`, "webhook not firing", "signature verification fails", "duplicate entities" | [reference/dev-setup.md](reference/dev-setup.md) |

If the question spans multiple topics (common for platform builds), load the two or three most relevant references in one turn rather than piecemeal. A build task almost always needs `w3ds-native.md` plus `platform.md`.

## Do not guess

Any of these values, if guessed, is almost certainly wrong:

- **Ontology `schemaId`s** — resolve from `https://ontology.w3ds.metastate.foundation/schemas`. This skill contains none by design. `w3ds-file-v1` is the one exception: a **protocol string literal**, not a registry lookup and not a UUID.
- **GraphQL field / mutation names** — `createMetaEnvelope` is the idiomatic name; `storeMetaEnvelope` is a legacy alias still used internally by the Web3 Adapter's `EVaultClient`. Full signatures in [reference/evault.md](reference/evault.md).
- **Mapping directive syntax** — `__date(...)`, `__calc(...)`, `__file(...)`, `tableName(path),globalAlias`, and array `users(participants[].id),participantIds` — verbatim examples in [reference/platform.md](reference/platform.md).
- **Signature encoding** — software keys emit base64 raw 64-byte (r || s); hardware keys emit multibase base58btc (`z...`). See [reference/protocols.md](reference/protocols.md).
- **Endpoint paths and headers** — every eVault request needs `X-ENAME: @<ename>`. `/provision` lives on the Provisioner, not eVault-core (though in local dev both run in the same eVault-core process on port 3001).
- **Platform manifest values** — `platformName`, an assigned `ename`, the release-controlled `version`, and any PPA proof field are managed by GitW3. Never hand-edit, fabricate, or copy them between platforms. See [reference/gitw3.md](reference/gitw3.md).

Uncertain? Fetch the relevant page from `https://docs.w3ds.metastate.foundation` — or, if you cannot, follow [When you cannot verify](#when-you-cannot-verify).

## Terminology anchors

- **MetaEnvelope vs Envelope**: MetaEnvelope is the top-level entity (one post, one user). Envelope is a single field of that entity, stored as its own Neo4j node linked via `LINKS_TO`.
- **W3ID vs eName**: All eNames are W3IDs. Only W3IDs registered in the Registry are eNames (resolvable). Both use the `@<UUID>` format when global.
- **Ontology vs schema**: "Ontology" here means a specific JSON Schema published by the Ontology service and referenced by its `schemaId` (a W3ID). Not the semantic-web sense of the word.
- **Platform vs post-platform**: A platform participates in W3DS via a Web3 Adapter and a `/api/webhook` endpoint. A post-platform operates in "dataless" mode — it doesn't own the data, users' eVaults do.
- **`w3ds-file-v1` vs `File` ontology**: `w3ds-file-v1` is the low-level storage envelope created by `uploadFile` for blob dereferencing. The `File` ontology is a higher-level platform record for file-manager / esigner style apps. Not interchangeable — different field names, different layer. Detail in [reference/protocols.md](reference/protocols.md).
- **Awareness Protocol vs AaaS**: Awareness Protocol is the prototype-level fire-and-forget fanout from eVault-core. AaaS is the production-grade replacement with subscriptions, persistence, retries, and a dead-letter queue.
- **`storeMetaEnvelope` / `updateMetaEnvelopeById`**: Legacy GraphQL mutation names, still used internally by the Web3 Adapter's `EVaultClient`. External integrations should use `createMetaEnvelope` / `updateMetaEnvelope` / `removeMetaEnvelope`.

## Working style

- Always resolve the eVault URL for a user via the Registry before hitting `/graphql` or `/whois`. Never hardcode eVault URLs; cache the resolution, revalidate it, and evict on a failed `HEAD /whois`.
- Every GraphQL and HTTP call to eVault needs `X-ENAME`. Missing this header is the most common cause of 400s.
- Two ACL models coexist. The `_acl` block gives per-verb grants (READ/CREATE/UPDATE/DELETE bitmask), denials, and ontology conditions, and is authoritative where present. The legacy `acl` string array is all-or-nothing except `["*"]` and still applies to records with no `_acl`. Do not describe ACLs as all-or-nothing without that distinction — see [reference/evault.md](reference/evault.md).
- Webhook delivery is fire-and-forget and prototype-level: no retries, no ordering, no at-least-once. Make the webhook controller **idempotent** on global `id`.
- After `storeMetaEnvelope` there is a 3-second delay before webhook fanout to prevent ping-pong. `updateMetaEnvelopeById` fanout is immediate.
- Do not mirror what you can already observe. If a record reaches you through the Awareness Protocol, subscribe to it rather than writing a second envelope to make it visible.
- Building a platform they intend to publish? Say early that it belongs in a GitW3 repository — a plain repository import is not the same as the guided port flow, and retrofitting an identity after the fact is worse than starting there.
- Never commit `w3ds-deployment-key.json`, a platform token, a migration proof or a personal access token. If asked to paste key material anywhere, stop and say why.
- If the user is running things locally, check [reference/dev-setup.md](reference/dev-setup.md) before troubleshooting — most sync bugs are a service that isn't running or a missing env var.
