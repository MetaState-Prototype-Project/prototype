---
sidebar_position: 5
---

# Ontology

The Ontology service is the schema registry for W3DS. It serves JSON Schema (draft-07) definitions identified by a W3ID (`schemaId`). eVault uses these schema IDs in MetaEnvelopes to indicate the type of stored data and to map envelope fields to schema property names.

## Overview

- **Schema registry**: Schemas define the shape of data stored in eVault (posts, users, messages, votes, etc.).
- **Schema IDs**: Each schema has a unique `schemaId` (W3ID). eVault’s MetaEnvelope `ontology` field stores this W3ID; each Envelope’s `ontology` field stores the **property name** from the schema (e.g. `content`, `authorId`, `createdAt`).
- **API**: List schemas and fetch a schema by W3ID as raw JSON. A human-facing viewer is also available at the service root.

See [eVault — Data Model](/docs/Infrastructure/eVault#data-model) for how MetaEnvelopes and Envelopes use ontology.

## API

### GET /schemas

Returns a list of all available schemas.

**Response** (200):

```json
[
    { "id": "550e8400-e29b-41d4-a716-446655440000", "title": "User", "domain": "identity" },
    { "id": "550e8400-e29b-41d4-a716-446655440001", "title": "SocialMediaPost", "domain": "social" }
]
```

- `id`: Schema W3ID (`schemaId`).
- `title`: Human-readable schema title.
- `domain`: The domain the schema belongs to, or `null` if untagged. See [GET /domains](#get-domains).

This endpoint is the only correct way to obtain a `schemaId`. Match on `title`, then confirm the field names with `GET /schemas/:id` before writing a mapping. Schema IDs are not derivable, not sequential, and not stable enough to recall from memory — a wrong `schemaId` means every awareness packet for that type is silently dropped by receiving platforms.

### GET /schemas/:id

Returns the full JSON Schema for the given W3ID. Use this when you need the complete schema definition (e.g. for validation or to know required fields and types).

**Path parameter**: `id` — the schema’s `schemaId` (W3ID, e.g. `550e8400-e29b-41d4-a716-446655440001`).

**Response** (200): JSON Schema object (draft-07) with `schemaId`, `title`, `type`, `properties`, `required`, `additionalProperties`, etc.

**Errors**:

- **404**: Schema not found for the given W3ID.

### GET /domains

Returns the domain list every schema is tagged with — the same list a platform is granted access to, one domain at a time.

**Response** (200):

```json
{
    "schemaId": "<the Domain schema's own W3ID>",
    "domains": [
        { "id": "identity", "label": "Identity", "description": "..." },
        { "id": "social", "label": "Social", "description": "..." }
    ]
}
```

The list is not a separate config file: it is read from the `Domain` schema's own enum, so it is versioned, browsable and fetchable like any other type.

### GET /domains/:id/schemas

Returns every schema under one domain: `{ "domain": { ... }, "schemas": [ { "id", "title" } ] }`. **404** if the domain does not exist.

Use this when you know the subject area but not the type name — "what does W3DS already have for finance?" — before concluding that nothing fits and [proposing a new ontology](#proposing-a-new-ontology).

### Human-facing viewer

- **GET /** — Renders a viewer page that lists schemas and supports search. Optional query `?q=...` filters by title or ID; `?schema=<id>` shows one schema.
- **GET /schema/:id** — Same viewer with a specific schema selected (permalink).

These endpoints are for browsing in a browser; for integration use `GET /schemas` and `GET /schemas/:id`.

## Schema format

Each schema file is JSON Schema draft-07 and must include:

- **schemaId**: W3ID that uniquely identifies the schema (used in eVault MetaEnvelopes).
- **title**: Short name (e.g. `SocialMediaPost`, `User`).
- **type**: Typically `"object"`.
- **properties**: Map of property names to JSON Schema types (string, number, array, object, etc.). In eVault, each property becomes an Envelope whose `ontology` field is this property name.
- **required**: Array of required property names.
- **additionalProperties**: Usually `false` for strict typing.

Example (conceptually):

```json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "schemaId": "550e8400-e29b-41d4-a716-446655440001",
    "title": "SocialMediaPost",
    "type": "object",
    "properties": {
        "id": { "type": "string", "format": "uri", "description": "W3ID" },
        "authorId": { "type": "string", "format": "uri", "description": "W3ID" },
        "content": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" }
    },
    "required": ["id", "authorId", "createdAt"],
    "additionalProperties": false
}
```

In eVault, a MetaEnvelope for a post would have `ontology: "550e8400-e29b-41d4-a716-446655440001"`, and its Envelopes would have `ontology` values such as `content`, `authorId`, `createdAt`.

## Proposing a new ontology

Nothing in W3DS obliges you to squeeze your data into an existing type. If no schema fits what you are modelling, the correct move is to **propose a new one** — never to invent a `schemaId` and ship it.

An invented `schemaId` does not fail loudly. The MetaEnvelope is written, the awareness packet fans out, and every receiving platform finds no mapping for that schema and drops it. The data becomes unreachable to the ecosystem while looking perfectly healthy on the platform that wrote it.

### Before proposing

1. `GET /schemas` and search the titles.
2. `GET /domains/:id/schemas` for the domain your data belongs to.
3. Read the near misses in full with `GET /schemas/:id`.

Reuse beats addition, and **extending a near match by PR beats creating a parallel type**. Two schemas that mean the same thing split the ecosystem in half: platforms mapping one will not see data from platforms mapping the other.

### Write the schema

Schemas are ordinary files in the [prototype repository](https://github.com/MetaState-Prototype-Project/prototype), under `services/ontology/schemas/<name>.json`. The service loads the directory into an in-memory index at boot; there is no database and no registration call.

```json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "schemaId": "<a freshly generated random UUIDv4>",
    "title": "Bookmark",
    "domain": "productivity",
    "type": "object",
    "properties": {
        "id": {
            "type": "string",
            "format": "uuid",
            "description": "The unique identifier for the bookmark"
        },
        "userId": {
            "type": "string",
            "format": "uuid",
            "description": "The ID of the user who created the bookmark"
        },
        "createdAt": {
            "type": "string",
            "format": "date-time",
            "description": "When the bookmark was created"
        }
    },
    "required": ["id", "userId", "createdAt"],
    "additionalProperties": false
}
```

Requirements:

- **`schemaId`** — a freshly generated random UUIDv4 (`uuidgen`, `crypto.randomUUID()`). Never derive one from an existing ID, never continue a numeric sequence you notice in the directory, and never reuse an ID from another schema.
- **`title`** — the type name as other platforms will search for it. Singular, PascalCase.
- **`domain`** — one value from the `Domain` schema's enum, fetchable at `GET /domains`. Platforms are granted access domain by domain, so this decides who can consume the type.
- **`properties`** — every field with a `description`. Each property name becomes an Envelope's `ontology` value in the eVault, so **name fields for their cross-platform meaning, not after your local columns**. `authorId` is a W3DS field name; `fk_user_id_2` is not.
- **`required`** — the fields a consumer can rely on being present.
- **`additionalProperties`** — `false`, unless you have a specific reason.

### Open the PR

Add the file, open a pull request against the prototype repository, and say in the description what the type is for and which platform will write it. Reviewers will ask whether an existing schema could have carried the data — answer that question in the PR body and you will save a round trip.

Until the PR merges and the service redeploys, **the type does not exist**. Do not ship a `mapping.json` referencing an unmerged `schemaId`; the sync will look fine locally and silently drop everywhere else.

## Available schemas

To see all available schemas, call `GET /schemas` on the [Ontology production service](/docs/W3DS%20Basics/Links) or browse the [viewer](https://ontology.w3ds.metastate.foundation/) at the production base URL.

## Integration

- **eVault**: Stores `schemaId` in MetaEnvelope `ontology` and property names in Envelope `ontology`. Platforms and clients use the Ontology service to resolve schema W3IDs to full schemas for validation and display. See [eVault](/docs/Infrastructure/eVault).
- **Platforms**: Use schema IDs when calling eVault (e.g. `storeMetaEnvelope`, `findMetaEnvelopesByOntology`) and fetch schemas from the Ontology service when they need field definitions or validation. See [Post Platform Guide](/docs/Post%20Platform%20Guide/getting-started) and [Mapping Rules](/docs/Post%20Platform%20Guide/mapping-rules).

## References

- [eVault](/docs/Infrastructure/eVault) — MetaEnvelopes, Envelopes, and the `ontology` field
- [W3DS Basics](/docs/W3DS%20Basics/getting-started) — Ontology and schema concepts
- [Links](/docs/W3DS%20Basics/Links) — Production Ontology base URL
- [Data Ownership Rules](/docs/W3DS%20Basics/Data-Ownership-Rules) — why every persisted entity needs an ontology
