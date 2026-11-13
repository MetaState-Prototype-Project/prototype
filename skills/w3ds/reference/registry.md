# Registry + Ontology

The Registry is the discovery layer: it resolves W3IDs to service URLs, publishes JWKS, provides signed entropy for provisioning, and (temporarily) issues key-binding certificates. The Ontology service is the schema registry. Source: [Registry](https://docs.w3ds.metastate.foundation/docs/Infrastructure/Registry) and [Ontology](https://docs.w3ds.metastate.foundation/docs/Infrastructure/Ontology).

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

**This service is the only correct source of a `schemaId`.** This skill deliberately contains no ontology UUIDs: they are not derivable, not sequential, and not stable enough to recall. A wrong `schemaId` fails silently — the write succeeds and every receiving platform drops the packet for having no matching mapping.

### GET /schemas

Every registered schema:

```json
[
  { "id": "<schemaId>", "title": "User", "domain": "identity" },
  { "id": "<schemaId>", "title": "SocialMediaPost", "domain": "social" }
]
```

- `id` — the `schemaId` to put in `mapping.json` and in eVault calls.
- `title` — what to match on. Singular, PascalCase.
- `domain` — the domain the schema belongs to, or `null`.

### GET /schemas/:id

The full JSON Schema (draft-07) for a schema W3ID. 404 if not found. Read this before writing a mapping — it is where the real property names live.

Every schema includes: `schemaId` (W3ID), `title`, `domain`, `type` (usually `"object"`), `properties`, `required`, `additionalProperties: false` (usually).

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "schemaId": "<schemaId>",
  "title": "SocialMediaPost",
  "domain": "social",
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

In eVault, a `SocialMediaPost` MetaEnvelope has `ontology: "<the SocialMediaPost schemaId>"`; its Envelopes have `fieldKey` values matching the schema's property names (`content`, `authorId`, `createdAt`, ...).

### GET /domains

The domain list every schema is tagged with — the same list a platform is granted access to, one domain at a time. Returns `{ schemaId, domains: [{ id, label, description }] }`. Read from the `Domain` schema's own enum, so it is versioned like any other type.

### GET /domains/:id/schemas

Every schema under one domain: `{ domain, schemas: [{ id, title }] }`. 404 if the domain does not exist.

Use this when you know the subject area but not the type name — "what does W3DS already have for finance?" — before concluding nothing fits.

### Human viewer

- `GET /` — browser viewer with search (`?q=`).
- `GET /schema/:id` — permalink to one schema in the viewer.

Use `/schemas` and `/schemas/:id` for programmatic access.

## Resolving an ontology

The procedure, every time. Do not skip to memory.

1. `GET https://ontology.w3ds.metastate.foundation/schemas` and match on `title`.
2. Narrow first with `GET /domains/:id/schemas` when you know the subject area but not the name.
3. `GET /schemas/:id` on the match — confirm the property names before writing `localToUniversalMap`, because the mapping's global side must use them exactly.
4. No match? Read the near misses in full. Extending one by PR beats creating a parallel type.
5. Still nothing? [Propose a new ontology](https://docs.w3ds.metastate.foundation/docs/Infrastructure/Ontology#proposing-a-new-ontology) — full procedure in [w3ds-native.md](w3ds-native.md#proposing-a-new-ontology). Until that PR merges the type does not exist; do not ship a mapping against an unmerged `schemaId`.

Cannot reach the service? Use an obvious placeholder plus `// TODO(w3ds): unverified — confirm against https://ontology.w3ds.metastate.foundation/schemas`, and say so in your response. Never substitute a plausible-looking UUID.

### The one identifier that is not a lookup

`w3ds-file-v1` is a **protocol string literal**, not a registry entry and not a UUID. It is the low-level storage envelope created by `uploadFile` for blob dereferencing.

Never confuse it with the `File` ontology, which is a higher-level platform record (file-manager / esigner style apps) with its own resolvable `schemaId`. Different layers, different field names. Detail in [protocols.md § File URIs](protocols.md#file-uris-w3dsfile).

## Provisioner (adjacent, not part of Registry)

Production URL: `https://provisioner.w3ds.metastate.foundation`. Local dev port: **3001** (co-hosted by eVault-core).

`POST /provision` creates a new eVault. Detail in [wallet.md](wallet.md#provisioning--onboarding-a-new-evault). Body:

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

- Registry endpoints + JWKS: [Registry](https://docs.w3ds.metastate.foundation/docs/Infrastructure/Registry)
- Ontology API + schema format: [Ontology](https://docs.w3ds.metastate.foundation/docs/Infrastructure/Ontology)
- Provisioning flow: [eID Wallet](https://docs.w3ds.metastate.foundation/docs/Infrastructure/eID-Wallet), [wallet-sdk](https://docs.w3ds.metastate.foundation/docs/Infrastructure/wallet-sdk)
- Production URLs: [Links](https://docs.w3ds.metastate.foundation/docs/W3DS%20Basics/Links)
- Where data lives: [Data Ownership Rules](https://docs.w3ds.metastate.foundation/docs/W3DS%20Basics/Data-Ownership-Rules)
- Proposing a new ontology: [Ontology](https://docs.w3ds.metastate.foundation/docs/Infrastructure/Ontology#proposing-a-new-ontology)
