---
sidebar_position: 5
---

# Ontology

The Ontology service is the schema registry for W3DS. It serves JSON Schema (draft-07) definitions identified by a UUID (`schemaId`). eVault uses these schema IDs in MetaEnvelopes to indicate the type of stored data and to map envelope fields to schema property names.

## Overview

- **Schema registry**: Schemas define the shape of data stored in eVault (posts, users, messages, votes, etc.).
- **Schema IDs**: Each schema has a unique `schemaId` (UUID). eVault’s MetaEnvelope `ontology` field stores this UUID; each Envelope’s `ontology` field stores the **property name** from the schema (e.g. `content`, `authorId`, `createdAt`).
- **API**: List schemas and fetch a schema by UUID as raw JSON. A human-facing viewer is also available at the service root.

See [eVault — Data Model](/docs/Infrastructure/eVault#data-model) for how MetaEnvelopes and Envelopes use ontology.

## API

### GET /schemas

Returns a list of all available schemas.

**Response** (200):

```json
[
    { "id": "550e8400-e29b-41d4-a716-446655440000", "title": "User" },
    { "id": "550e8400-e29b-41d4-a716-446655440001", "title": "SocialMediaPost" }
]
```

- `id`: Schema UUID (`schemaId`).
- `title`: Human-readable schema title.

### GET /schemas/:uuid

Returns the full JSON Schema for the given UUID. Use this when you need the complete schema definition (e.g. for validation or to know required fields and types).

**Path parameter**: `uuid` — the schema’s `schemaId` (e.g. `550e8400-e29b-41d4-a716-446655440001`).

**Response** (200): JSON Schema object (draft-07) with `schemaId`, `title`, `type`, `properties`, `required`, `additionalProperties`, etc.

**Errors**:

- **404**: Schema not found for the given UUID.

### Human-facing viewer

- **GET /** — Renders a viewer page that lists schemas and supports search. Optional query `?q=...` filters by title or ID; `?schema=<uuid>` shows one schema.
- **GET /schema/:uuid** — Same viewer with a specific schema selected (permalink).

These endpoints are for browsing in a browser; for integration use `GET /schemas` and `GET /schemas/:uuid`.

## Schema format

Each schema file is JSON Schema draft-07 and must include:

- **schemaId**: UUID that uniquely identifies the schema (used in eVault MetaEnvelopes).
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
        "id": { "type": "string", "format": "uuid" },
        "authorId": { "type": "string", "format": "uuid" },
        "content": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" }
    },
    "required": ["id", "authorId", "createdAt"],
    "additionalProperties": false
}
```

In eVault, a MetaEnvelope for a post would have `ontology: "550e8400-e29b-41d4-a716-446655440001"`, and its Envelopes would have `ontology` values such as `content`, `authorId`, `createdAt`.

## Available schemas

The Ontology service ships with the following schemas (titles and typical use):

| Title | Purpose |
|-------|---------|
| User | User profile and identity |
| SocialMediaPost | Social posts (content, author, media, visibility) |
| Chat | Chat/conversation metadata |
| Message | Chat or direct messages |
| Currency | Currency definition (eCurrency) |
| Ledger | Ledger entries |
| Vote | Voting / ballot choices |
| Poll | Poll definition |
| File | File metadata |
| Signature (fileSignature) | File signature |
| Charter Signature | Charter signing |
| GroupManifest | Group manifest |
| Reference | Reference/link |
| Bookmark | Bookmark |

For the full list and latest schemas, query `GET /schemas` on the [Ontology production service](/docs/W3DS%20Basics/Links) or see the schemas in the repository under `services/ontology/schemas/`.

## Integration

- **eVault**: Stores `schemaId` in MetaEnvelope `ontology` and property names in Envelope `ontology`. Platforms and clients use the Ontology service to resolve UUIDs to full schemas for validation and display. See [eVault](/docs/Infrastructure/eVault).
- **Platforms**: Use schema IDs when calling eVault (e.g. `storeMetaEnvelope`, `findMetaEnvelopesByOntology`) and fetch schemas from the Ontology service when they need field definitions or validation.

## References

- [eVault](/docs/Infrastructure/eVault) — MetaEnvelopes, Envelopes, and the `ontology` field
- [W3DS Basics](/docs/W3DS%20Basics/getting-started) — Ontology and schema concepts
- [Links](/docs/W3DS%20Basics/Links) — Production Ontology base URL
