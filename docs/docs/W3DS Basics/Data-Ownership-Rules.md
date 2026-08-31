---
sidebar_position: 3
---

# Data Ownership Rules

This page is the rule set for anyone — human or coding agent — deciding **where a piece of data lives**. Everything else in the Post Platform Guide tells you how to move data. This tells you what belongs where, and why.

## The rule

W3DS states the principle in [Getting Started](/docs/Getting%20Started/getting-started#core-concept):

> **Users, groups, and objects own their own eVaults**. All data about a person, group, or object is stored in their eVault, and platforms act as frontends that display and interact with this data, while also serving as caches and aggregators for improved performance and user experience.

Stated as a rule you can apply while building:

> **The eVault is the source of truth. Anything a platform stores is a projection of it.**

Those two sentences are the same claim. "Cache and aggregator" is not a loophole that lets a platform own data — it is permission to keep a fast local copy of data that is authoritative somewhere else. A platform database is not forbidden. A platform database that is the *only* place some user data exists is.

This is what separates a W3DS-native application from a conventional one with synchronisation bolted on. Both have a local database. Only one of them can be deleted without losing anything.

## The reconstructability test

One question decides almost every case:

> **If the platform database were dropped and rebuilt by replaying the relevant eVaults, what would be lost?**

- **Nothing that matters** — the database is a projection. This is correct, and it is how [Pictique, Blabsy and eCurrency](/docs/Post%20Platform%20Guide/getting-started) work.
- **Something a user would miss** — that data has no home but yours. You have taken ownership of it without meaning to. Fix the design before writing more code.

Apply the test per entity type, not per application. A platform is usually correct about its posts and wrong about the one table someone added in a hurry.

### Worked cases

| Data | Reconstructable? | Verdict |
|---|---|---|
| A user's posts, mapped and synced to their eVault | Yes — replay from the author's eVault | Projection. Correct. |
| A draft the user never published, stored only in your Postgres | No | **Violation.** Drafts are the user's data; give them an ontology and an owner, or do not persist them. |
| A login session, a nonce, a job queue row | Nothing to reconstruct | Operational state. Correct — see below. |
| `(localId, globalId)` mapping rows | Rebuildable, but only by re-syncing | Operational state. Correct, and required. |
| A cached avatar URL resolved from a `w3ds://file` URI | Yes — re-dereference | Cache. Correct, if it can be re-derived. |

## What every persisted entity needs

Before a new entity type is persisted anywhere, three things must be true:

1. **An ontology.** A `schemaId` resolved from the [Ontology service](/docs/Infrastructure/Ontology), not invented. If nothing fits, [propose one](/docs/Infrastructure/Ontology#proposing-a-new-ontology) — do not proceed with a made-up identifier.
2. **A resolvable owner.** An `ownerEnamePath` that resolves to an eName for *every* row, not most of them. As [Web3 Adapter](/docs/Infrastructure/Web3-Adapter) puts it: "Data is always written to that owner's eVault." The owner is the data subject — the person or group the data is *about* — not the platform that happened to receive the write.
3. **A write path to the eVault.** A named call site: a `handleChange` after the local write, or a direct eVault write for a stateless app. "We will add sync later" means the platform owns the data today.

If any of the three is missing, the entity is platform-owned. That is the thing this page exists to prevent.

## Legitimate local-only state

The rule is about *user* data. These are operational and may live only on the platform:

- Sessions, auth nonces, and the short-lived session IDs from the [`w3ds://auth`](/docs/W3DS%20Protocol/Authentication) flow.
- Job queues, retry state, outbox rows, and dead letters.
- Rate limits, feature flags, and request logs.
- The `(localId, globalId)` mapping table the [Web3 Adapter](/docs/Infrastructure/Web3-Adapter) needs to avoid duplicating entities.
- Cached Registry resolutions and platform profile data — explicitly sanctioned in [Platform eVault registration](/docs/Post%20Platform%20Guide/platform-evault-registration), which tells platforms to save `w3id` and `uri` locally and reuse them on every boot.
- Derived indexes, search indexes, aggregates and denormalised read models built *from* eVault-sourced records.

The common thread: none of it is data about a user that a user would expect to take with them.

## What a projection may not do

- Be the only home for user data.
- Hold a field that has no counterpart in the entity's ontology. A column with nowhere to go in the mapping is data the platform has quietly claimed.
- Be read in preference to eVault-derived state when the eVault is reachable and current.
- Outlive the owner's decision to revoke access. Access policy is the owner's to set — see [Access Policy](/docs/W3DS%20Basics/Access-Policy) — and a projection that ignores a revocation is a copy the owner no longer consented to.
- Be treated as authoritative during a conflict. It is downstream by construction.

## Do not mirror what you can already observe

Duplication is its own failure. [File URIs](/docs/W3DS%20Protocol/File-URIs) makes the canonical version of this point: consuming the awareness packet is how a platform learns about a new blob — "there is no need to mirror the upload as a second envelope under the `File` ontology just to make it observable." The same reasoning applies generally. If a record is already observable through the Awareness Protocol, subscribing beats copying.

## Bounds on how much a projection can be trusted

Synchronisation is eventual, and the [Awareness Protocol](/docs/W3DS%20Protocol/Awareness-Protocol) is prototype-level. Design the projection to tolerate all of this:

- **Last-write-wins.** No merge, no CRDT.
- **No ordering guarantee**, and no at-least-once delivery.
- **Fire-and-forget fanout** with no retries at the protocol level. The requesting platform is excluded from its own fanout.
- **A delay after creation** before fanout, to prevent ping-pong; updates fan out immediately.

Consequences for your code: webhook handling must be **idempotent on the global `id`**, reads must tolerate a record that has not arrived yet, and nothing user-visible should depend on two platforms agreeing at the same instant.

## Stateless applications

An application that writes directly to eVaults and keeps no local database does not need a [Web3 Adapter](/docs/Infrastructure/Web3-Adapter) at all — the adapter exists to keep a database in sync, and there is nothing to sync. This is the simplest way to be W3DS-native, and it is the right default for small applications.

## For coding agents

If you are an AI agent building on W3DS, these rules are enforced by the [W3DS agent skill](/docs/Post%20Platform%20Guide/ai-agent-skill). The short version: run the reconstructability test before persisting anything new, resolve every identifier instead of recalling it, and stop and ask rather than designing a platform that owns its users' data.
