# Registry + Ontology

The Registry is the discovery layer: it resolves W3IDs to service URLs, publishes JWKS, provides signed entropy for provisioning, and (temporarily) issues key-binding certificates. The Ontology service is the schema registry. Source: `docs/docs/Infrastructure/Registry.md`, `Ontology.md`.

## Registry

Production URL: `https://registry.w3ds.metastate.foundation`. Local dev port: **4321**.

### GET /resolve?w3id=@\<w3id\>

Resolve an eName to its service endpoint.

Response (200):

```json
{
  "ename": "@user.w3id",
  "uri": "https://resolved-service.example.com",
  "evault": "evault-identifier",
  "originalUri": "https://...",
  "resolved": false
}
```

- `uri` — the endpoint to use for GraphQL / whois calls.
- `evault` — the eVault instance identifier (matches the `evaultId` returned by `/whois`).
- `resolved` — whether the URI was runtime-resolved (e.g. via health check).

Errors:

- 400 — missing `w3id` query param.
- 404 — no vault entry for that W3ID.

Callers: Web3 Adapter's `EVaultClient` (before every store/update), the signature validator (before verifying), platforms (whenever they need the eVault URL for a user).

### GET /list

Returns every registered vault entry. No auth. Used by eVault-core to build the platform fanout list during Awareness Protocol delivery. Response is an array of `{ ename, uri, evault, originalUri, resolved }`.

Note: some docs / code references call this `GET /platforms` — same concept.

### GET /entropy

Returns a signed ES256 JWT with 20 alphanumeric chars of entropy, used for provisioning.

Response:

```json
{ "token": "eyJhbGciOiJFUzI1NiIs..." }
```

JWT payload: `{ entropy: "<20 chars>", iat, exp }`. Valid 1 hour. Verify against `/.well-known/jwks.json`.

### GET /.well-known/jwks.json

Standard JWK set. Contains an EC P-256, ES256, `use: "sig"` key. Used to verify:

- `/entropy` JWTs
- Key binding certificate JWTs served by eVault `/whois`

### Key binding certificates (temporary — moving to Remote CA)

The Registry currently issues JWTs binding an eName to a public key. Payload: `{ ename, publicKey, iat, exp }` (~1 hour TTL). Header: `{ alg: "ES256", kid: "entropy-key-1" }`.

Flow: eVault stores a user's public key at provisioning time and internally requests a certificate from the Registry. The certificate is later served in `/whois` responses so verifiers can trust the eName↔publicKey binding without trusting the eVault directly.

**Roadmap**: this responsibility moves to a Remote CA / Remote Notary. Treat the current Registry role as a prototype shortcut.

## Ontology service

Production URL: `https://ontology.w3ds.metastate.foundation`.

### GET /schemas

Returns a list of every registered schema:

```json
[
  { "id": "550e8400-e29b-41d4-a716-446655440000", "title": "User" },
  { "id": "550e8400-e29b-41d4-a716-446655440001", "title": "SocialMediaPost" }
]
```

### GET /schemas/:id

Returns the full JSON Schema (draft-07) for a schema W3ID. 404 if not found.

Every schema must include: `schemaId` (W3ID), `title`, `type` (usually `"object"`), `properties`, `required`, `additionalProperties: false` (usually).

Example:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "schemaId": "550e8400-e29b-41d4-a716-446655440001",
  "title": "SocialMediaPost",
  "type": "object",
  "properties": {
    "id":        { "type": "string", "format": "uri", "description": "W3ID" },
    "authorId":  { "type": "string", "format": "uri", "description": "W3ID" },
    "content":   { "type": "string" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "authorId", "createdAt"],
  "additionalProperties": false
}
```

In eVault, a `SocialMediaPost` MetaEnvelope has `ontology: "550e8400-e29b-41d4-a716-446655440001"`; its Envelopes have `fieldKey` values matching the schema's property names (`content`, `authorId`, `createdAt`, ...).

### Human viewer

- `GET /` — browser viewer with search (`?q=`).
- `GET /schema/:id` — permalink to one schema in the viewer.

Use `/schemas` and `/schemas/:id` for programmatic access.

## Canonical ontology W3IDs

Memorize this table. These IDs appear in mapping.json files, in Awareness Protocol packets (`schemaId`), and in every eVault call — guessing them is guaranteed to be wrong.

| Ontology | ID |
|---|---|
| **User** | `550e8400-e29b-41d4-a716-446655440000` |
| **SocialMediaPost** | `550e8400-e29b-41d4-a716-446655440001` |
| **Group** | `550e8400-e29b-41d4-a716-446655440003` |
| **Ledger** (eCurrency) | `550e8400-e29b-41d4-a716-446655440006` |
| **Currency** (eCurrency) | `550e8400-e29b-41d4-a716-446655440008` |
| **Account** (eCurrency) | `6fda64db-fd14-4fa2-bd38-77d2e5e6136d` |
| **Binding Document** | `b1d0a8c3-4e5f-6789-0abc-def012345678` |
| **File** (application layer) | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| **`w3ds-file-v1`** (storage layer) | `w3ds-file-v1` — **string literal, not a UUID** |

Never confuse the `File` ontology and `w3ds-file-v1`. Different layers, different field names. Detail in [protocols.md § File URIs](protocols.md#file-uris-w3dsfile).

If a user asks about an ontology not on this list, call `GET https://ontology.w3ds.metastate.foundation/schemas` to enumerate — do not guess.

## Provisioner (adjacent, not part of Registry)

Production URL: `https://provisioner.w3ds.metastate.foundation`. Local dev port: **3001** (co-hosted by eVault-core).

`POST /provision` creates a new eVault. Detail in [wallet.md](wallet.md#provisioning). Body:

```json
{
  "registryEntropy": "<JWT from GET /entropy>",
  "namespace": "<UUID>",
  "verificationId": "<KYC verification code or demo code>",
  "publicKey": "z..."         // optional — omit for keyless (platform / group) eVaults
}
```

Response: `{ w3id, uri }`.

## References in the docs

- Registry endpoints + JWKS: `docs/docs/Infrastructure/Registry.md`
- Ontology API + schema format: `docs/docs/Infrastructure/Ontology.md`
- Provisioning flow: `docs/docs/Infrastructure/eID-Wallet.md`, `docs/docs/Infrastructure/wallet-sdk.md`
- Production URLs: `docs/docs/W3DS Basics/Links.md`
