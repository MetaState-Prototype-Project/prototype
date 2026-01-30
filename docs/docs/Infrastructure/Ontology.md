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
    { "id": "550e8400-e29b-41d4-a716-446655440000", "title": "User" },
    { "id": "550e8400-e29b-41d4-a716-446655440001", "title": "SocialMediaPost" }
]
```

- `id`: Schema W3ID (`schemaId`).
- `title`: Human-readable schema title.

### GET /schemas/:id

Returns the full JSON Schema for the given W3ID. Use this when you need the complete schema definition (e.g. for validation or to know required fields and types).

**Path parameter**: `id` — the schema’s `schemaId` (W3ID, e.g. `550e8400-e29b-41d4-a716-446655440001`).

**Response** (200): JSON Schema object (draft-07) with `schemaId`, `title`, `type`, `properties`, `required`, `additionalProperties`, etc.

**Errors**:

- **404**: Schema not found for the given W3ID.

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

## Available schemas

To see all available schemas, call `GET /schemas` on the [Ontology production service](/docs/W3DS%20Basics/Links) or browse the [viewer](https://ontology.w3ds.metastate.foundation/) at the production base URL.

## Integration

- **eVault**: Stores `schemaId` in MetaEnvelope `ontology` and property names in Envelope `ontology`. Platforms and clients use the Ontology service to resolve schema W3IDs to full schemas for validation and display. See [eVault](/docs/Infrastructure/eVault).
- **Platforms**: Use schema IDs when calling eVault (e.g. `storeMetaEnvelope`, `findMetaEnvelopesByOntology`) and fetch schemas from the Ontology service when they need field definitions or validation. See [Post Platform Guide](/docs/Post%20Platform%20Guide/getting-started) and [Mapping Rules](/docs/Post%20Platform%20Guide/mapping-rules).

## References

- [eVault](/docs/Infrastructure/eVault) — MetaEnvelopes, Envelopes, and the `ontology` field
- [W3DS Basics](/docs/W3DS%20Basics/getting-started) — Ontology and schema concepts
- [Links](/docs/W3DS%20Basics/Links) — Production Ontology base URL
