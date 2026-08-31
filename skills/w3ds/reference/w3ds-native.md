# Building W3DS-native

Load this when the task is a design decision rather than an API call: adding a table, entity, model or field; deciding what to cache; reviewing whether an application is actually W3DS-native or just W3DS-flavoured.

Authoritative source: [Data Ownership Rules](https://docs.w3ds.metastate.foundation/docs/W3DS%20Basics/Data-Ownership-Rules). Supporting: [Getting Started](https://docs.w3ds.metastate.foundation/docs/Getting%20Started/getting-started), [W3DS Basics](https://docs.w3ds.metastate.foundation/docs/W3DS%20Basics/getting-started), [Web3 Adapter](https://docs.w3ds.metastate.foundation/docs/Infrastructure/Web3-Adapter).

## The claim, and what it does not mean

> **The eVault is the source of truth. Anything a platform stores is a projection of it.**

The docs also say platforms "act as frontends that display and interact with this data, while also serving as caches and aggregators for improved performance and user experience." Those are not in tension. A cache is a fast copy of something authoritative elsewhere. The permission is to keep the copy; it was never permission to be the original.

So: **a local database is fine.** Pictique, Blabsy and eCurrency all run one. What is not fine is a local database that is the only place some user data exists.

## The reconstructability test

The one question that settles almost every case:

> If this database were dropped and rebuilt by replaying the relevant eVaults, what would be lost?

Apply it **per entity type**, not per application. Platforms are usually correct about their main entity and wrong about the one table someone added in a hurry.

### Worked examples

**A user's post — projection, correct.**
The post is mapped, has an `ownerEnamePath` resolving to the author, and `handleChange` runs on write. Drop the database, replay the authors' eVaults, and every post comes back. The local row exists so the feed renders in 20ms instead of N eVault round trips. Textbook cache.

**A draft the user never published — violation.**
It is in `posts` with `status = 'draft'`, and the mapping only syncs on publish. Drop the database and the user's unfinished work is gone — there is nowhere to replay it from. This is user data the platform has taken ownership of by accident.

*The fix is not "sync drafts to the eVault" reflexively.* Ask which is true: (a) it is user data → give it an ontology and an owner, and sync it; or (b) it is genuinely ephemeral UI state the user does not expect to survive → keep it client-side and say so. What you may not do is persist it server-side, indefinitely, in the platform's database alone.

**A session token — operational, correct.**
Nothing to reconstruct; it is meaningless outside this platform and expires. Never belonged in an eVault.

**A `(localId, globalId)` mapping row — operational, correct and required.**
It is bookkeeping *about* the sync, not user data. Without it the same logical entity gets duplicated or never linked, which is [the classic integration bug](https://docs.w3ds.metastate.foundation/docs/Infrastructure/Web3-Adapter).

**A denormalised follower count — projection, correct.**
Derived from records that are themselves eVault-sourced. Recomputable, so nothing is lost.

## What every persisted entity needs

1. **An ontology** — a `schemaId` resolved from the Ontology service. Never invented.
2. **A resolvable owner** — an `ownerEnamePath` that resolves for *every* row. The owner is the data subject: the person or group the data is *about*.
3. **A named write path** — the `handleChange` call site, or the direct eVault write.

Missing any one means the entity is platform-owned.

## Legitimate local-only state

- Sessions, auth nonces, the short-lived session IDs from the `w3ds://auth` flow.
- Job queues, retry state, outbox rows, dead letters.
- Rate limits, feature flags, request logs.
- The `(localId, globalId)` mapping table.
- Cached Registry resolutions and the platform's own `w3id` / `uri`, which [Platform eVault registration](https://docs.w3ds.metastate.foundation/docs/Post%20Platform%20Guide/platform-evault-registration) explicitly tells platforms to persist and reuse on boot.
- Derived indexes, search indexes, aggregates and read models built *from* eVault-sourced records.

Common thread: none of it is data about a user that a user would expect to take with them.

## Anti-patterns

### 1. A local table with no mapping

**Wrong** — a `reactions` table, no `mapping.json`, no `schemaId`. Likes exist on this platform and nowhere else.

**Right** — resolve an ontology for it (`GET /schemas`, narrow with `GET /domains/:id/schemas`); if none fits, propose one (below) and say the type does not exist until the PR merges.

**Why** — reactions are the user's data. Without an ontology they cannot leave, and the platform has silently claimed them.

### 2. `handleChange` never called

**Wrong** — the entity is mapped, but the write happens in a migration, an admin endpoint or a background job that skips the adapter.

**Right** — name the write hook and cover *every* path: an ORM event listener (afterInsert / afterUpdate / afterRemove) or a transactional outbox, not a call bolted onto one controller. The adapter does **not** poll; if nobody calls it, nothing syncs.

**Why** — partial coverage is worse than none. Rows written through the uncovered path are invisible to the ecosystem while looking synced.

### 3. `ownerEnamePath` pointing at the platform

**Wrong** — `"ownerEnamePath": "ename"` resolving to the platform's own eName for records about users, because it always resolves and makes the errors go away.

**Right** — resolve to the data subject: `users(createdBy.ename)`, `users(participants[].ename)`, with `||` fallbacks only between paths that all name the subject.

**Why** — the data lands in the platform's eVault. Ownership, ACLs and portability all follow the owner eName, so this is platform-owned data wearing an eVault costume. The user cannot take it, revoke it, or see it from another platform.

### 4. Reading local in preference to eVault-derived state

**Wrong** — the local row is served as canonical, and inbound webhook updates are dropped or merged as "conflicts" against it.

**Right** — inbound wins on the entity's own fields; the local row is a projection. Keep local-only columns strictly to operational state.

**Why** — the platform becomes authoritative in practice regardless of what the architecture diagram says, and a user's change from another platform silently disappears.

### 5. Inventing a `schemaId` to unblock

**Wrong** — a plausible UUID in `mapping.json` so the work can proceed.

**Right** — resolve it, or propose the schema. If you genuinely cannot reach the Ontology service, use an obvious placeholder plus `// TODO(w3ds): unverified` and say so in your response.

**Why** — this fails silently and expensively. The MetaEnvelope writes, the packet fans out, and every receiving platform finds no mapping and drops it. Everything looks healthy on the writing platform.

### 6. Mirroring an uploaded blob as a second `File` record

**Wrong** — after `uploadFile`, writing a second envelope under the `File` ontology so the upload is observable.

**Right** — consume the awareness packet. [File URIs](https://docs.w3ds.metastate.foundation/docs/W3DS%20Protocol/File-URIs) states it directly: there is no need to mirror the upload just to make it observable.

**Why** — two records for one blob, drifting apart, and `w3ds-file-v1` and the `File` ontology are different layers with different field names.

### 7. Caching a resolved eVault URL forever

**Wrong** — resolve once, store the URL, use it indefinitely (or hardcode it).

**Right** — cache the resolution, revalidate, evict on a failed `HEAD /whois` and re-resolve. This is what `EVaultClient` does.

**Why** — the eName is permanent, the URL is not. eVaults migrate; the Registry is how you find out.

### 8. Treating eventual consistency as immediate

**Wrong** — write locally, then immediately read back the eVault-derived version and assume it is there.

**Right** — design for last-write-wins, no ordering, no at-least-once delivery, a delay after create before fanout (immediate on update), and the requesting platform excluded from its own fanout. Idempotent on the global `id`, tolerant of a record that has not arrived.

**Why** — the Awareness Protocol is prototype-level and fire-and-forget. Anything user-visible that assumes otherwise breaks intermittently and unreproducibly.

## Proposing a new ontology

The escape hatch when nothing fits. Ontologies are ordinary JSON files anyone can propose, so "no ontology exists" is never a reason to invent one or to give up.

**First, be sure.** `GET https://ontology.w3ds.metastate.foundation/schemas` and search titles; `GET /domains/:id/schemas` for the subject area; read near misses in full with `GET /schemas/:id`. **Extending a near match by PR beats creating a parallel type** — two schemas meaning the same thing split the ecosystem, and platforms mapping one will not see data from platforms mapping the other.

**Then write it.** A file at `services/ontology/schemas/<name>.json` in `MetaState-Prototype-Project/prototype`. The service loads the directory into an in-memory index at boot — no database, no registration call.

```json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "schemaId": "<a freshly generated random UUIDv4>",
    "title": "Reaction",
    "domain": "social",
    "type": "object",
    "properties": {
        "id":        { "type": "string", "format": "uuid", "description": "The unique identifier for the reaction" },
        "authorId":  { "type": "string", "format": "uri",  "description": "W3ID of the reacting user" },
        "targetId":  { "type": "string", "format": "uri",  "description": "W3ID of the record reacted to" },
        "kind":      { "type": "string", "description": "The reaction type, e.g. like" },
        "createdAt": { "type": "string", "format": "date-time", "description": "When the reaction was created" }
    },
    "required": ["id", "authorId", "targetId", "createdAt"],
    "additionalProperties": false
}
```

- **`schemaId`** — freshly generated random UUIDv4 (`uuidgen`, `crypto.randomUUID()`). Never derived from an existing ID, never continuing a numeric sequence you notice in the directory.
- **`title`** — the type name others will search for. Singular, PascalCase.
- **`domain`** — one value from `GET /domains`. Platforms are granted access domain by domain, so this decides who can consume the type.
- **`properties`** — every field with a `description`. Each property name becomes an Envelope's `ontology` value, so **name fields for cross-platform meaning, not after local columns**.
- **`additionalProperties`** — `false` unless there is a specific reason.

**Then open the PR**, saying what the type is for and which platform will write it, and answering up front why no existing schema could carry it.

**Until it merges, the type does not exist.** Do not ship a `mapping.json` referencing an unmerged `schemaId` — it will look fine locally and drop everywhere else.

Full version: [Proposing a new ontology](https://docs.w3ds.metastate.foundation/docs/Infrastructure/Ontology#proposing-a-new-ontology).

## Stateless is simplest

An application that writes directly to eVaults and keeps no local database needs no Web3 Adapter at all — the adapter exists to keep a database in sync, and there is nothing to sync. For a small application this is both the least code and the most obviously W3DS-native option. Suggest it before building a sync layer nobody asked for.

## Review checklist

For an existing platform, in order:

1. List every persisted table or collection.
2. For each, find the `mapping.json`. No mapping → is it operational state, or claimed user data?
3. For each mapping, check `ownerEnamePath` resolves to the data subject for every row, not just the common case.
4. Find every write path per mapped table — migrations, seeds, admin endpoints, background jobs included — and confirm each reaches `handleChange`.
5. Check the webhook controller is idempotent on global `id` and 200s ontologies it does not consume.
6. Run the reconstructability test over the whole set and state what would be lost.
