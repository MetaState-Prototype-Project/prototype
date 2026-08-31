# eVault — data store + GraphQL

The eVault is the personal data store for a single W3ID. One eVault per tenant, Neo4j-backed, GraphQL at `/graphql`, HTTP endpoints for identity/log/file resolution. Source: `docs/docs/Infrastructure/eVault.md`.

## Data model

- **MetaEnvelope**: top-level container for one entity (post, user, message). Fields: `id` (W3ID), `ontology` (schemaId W3ID), `acl` (array), `envelopes` (list).
- **Envelope**: one field of a MetaEnvelope stored as its own Neo4j node. Fields: `id`, `fieldKey` (e.g. `"content"`, `"authorId"`), `ontology` (legacy alias for `fieldKey`), `value`, `valueType` (`"string" | "number" | "object" | "array"`).
- Neo4j structure: `(MetaEnvelope {id, ontology, acl}) -[:LINKS_TO]-> (Envelope {id, fieldKey, value, valueType})`.
- Flat graph, not nested — enables field-level updates and searching, at the cost of reconstruction complexity for deeply nested payloads.

## Required header

Every GraphQL and HTTP call to eVault MUST include:

```http
X-ENAME: @<owner-ename>
```

Missing this header returns 400 or "access denied" — it is the #1 integration bug.

## GraphQL — idiomatic API

All shown below verified against `docs/docs/Infrastructure/eVault.md`. Endpoint: `POST {evaultUrl}/graphql`.

### Query one

```graphql
query {
  metaEnvelope(id: "global-id-123") {
    id
    ontology
    parsed
    envelopes { id fieldKey value valueType }
  }
}
```

`parsed` returns the reconstructed object form (payload dict). Prefer it over walking envelopes yourself.

### Query many (cursor-paginated, filterable)

```graphql
query {
  metaEnvelopes(
    filter: {
      ontologyId: "550e8400-e29b-41d4-a716-446655440001"
      search: { term: "hello", caseSensitive: false, mode: CONTAINS }
    }
    first: 10
    after: "cursor-string"
  ) {
    edges { cursor node { id ontology parsed } }
    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
    totalCount
  }
}
```

Filter fields: `ontologyId`, `search.term`, `search.caseSensitive`, `search.fields` (array of fieldKeys to restrict search to), `search.mode` (`CONTAINS | STARTS_WITH | EXACT`). Pagination: `first`/`after` forward, `last`/`before` backward.

### Create

```graphql
mutation {
  createMetaEnvelope(input: {
    ontology: "550e8400-e29b-41d4-a716-446655440001"
    payload: {
      content: "Hello, world!"
      mediaUrls: []
      authorId: "@e4d909c2-..."
      createdAt: "2025-01-24T10:00:00Z"
    }
    acl: ["*"]
  }) {
    metaEnvelope { id ontology parsed envelopes { id fieldKey value } }
    errors { field message code }
  }
}
```

Structured payload response — always check `errors[]` even on 200 OK.

### Update

```graphql
mutation {
  updateMetaEnvelope(
    id: "global-id-123"
    input: {
      ontology: "550e8400-e29b-41d4-a716-446655440001"
      payload: { content: "Updated content", mediaUrls: [] }
      acl: ["*"]
    }
  ) {
    metaEnvelope { id ontology parsed }
    errors { message code }
  }
}
```

### Remove

```graphql
mutation {
  removeMetaEnvelope(id: "global-id-123") {
    deletedId
    success
    errors { message code }
  }
}
```

### Bulk create

For migrations and initial seeds only. Requires `Authorization: Bearer <jwt>` in addition to `X-ENAME`. Supports optional `id` per input (preserves IDs across migrations).

```graphql
mutation {
  bulkCreateMetaEnvelopes(
    inputs: [
      { id: "custom-id-1", ontology: "550e8400-...", payload: {...}, acl: ["*"] }
      { ontology: "550e8400-...", payload: {...}, acl: ["@platform-a.w3id"] }
    ]
    skipWebhooks: false
  ) {
    results { id success error }
    successCount
    errorCount
    errors { message code }
  }
}
```

`skipWebhooks: true` only takes effect for migration-authorized platforms (e.g. Emover). Regular platform tokens ignore it.

### File upload

```graphql
mutation UploadFile($input: UploadFileInput!) {
  uploadFile(input: $input) {
    uri              # w3ds://file?id=@<ename>/<meta-envelope-id>
    metaEnvelopeId
    publicUrl        # direct object-storage URL
    errors { field message code }
  }
}
```

`UploadFileInput`: `filename` (string), `contentType` (string, MIME), `content` (base64 or `data:` URI), `acl` (array). Decoded size must be ≤ 250 MB. Requires `X-ENAME` and object storage configured on the eVault. Detail on the `w3ds://file` scheme → [protocols.md](protocols.md).

### Binding documents

```graphql
query {
  bindingDocument(id: "meta-envelope-id") {
    subject type data
    signatures { signer signature timestamp }
  }
}

query {
  bindingDocuments(type: id_document, first: 10) {
    edges { node { subject type data signatures { signer signature timestamp } } }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}

mutation {
  createBindingDocument(input: {
    subject: "@e4d909c2-..."
    type: id_document            # or photograph | social_connection | self
    data: { vendor: "onfido", reference: "ref-12345", name: "John Doe" }
    ownerSignature: {
      signer: "@e4d909c2-..."
      signature: "sig_abc123..."
      timestamp: "2025-01-24T10:00:00Z"
    }
  }) {
    metaEnvelopeId
    bindingDocument { subject type data signatures { signer signature timestamp } }
    errors { message code }
  }
}

mutation {
  createBindingDocumentSignature(input: {
    bindingDocumentId: "meta-envelope-id"
    signature: { signer: "@counterparty-uuid", signature: "sig_xyz...", timestamp: "2025-01-24T11:00:00Z" }
  }) {
    bindingDocument { subject type signatures { signer signature timestamp } }
    errors { message code }
  }
}
```

Binding documents are stored as MetaEnvelopes with ontology `b1d0a8c3-4e5f-6789-0abc-def012345678`. The MetaEnvelope ID is the binding document ID. See [identity.md](identity.md) for the type-specific data shapes.

## GraphQL — legacy names (still valid)

Preserved for backward compat; internal use by the Web3 Adapter's `EVaultClient`:

- `storeMetaEnvelope(input: MetaEnvelopeInput!)` → use `createMetaEnvelope`
- `updateMetaEnvelopeById(id: String!, input: MetaEnvelopeInput!)` → use `updateMetaEnvelope`
- `deleteMetaEnvelope(id: String!)` → use `removeMetaEnvelope` (legacy returned `Boolean!`; new returns a payload)
- `getMetaEnvelopeById(id: String!)` → use `metaEnvelope(id: ID!)`
- `findMetaEnvelopesByOntology(ontology: String!)` → use `metaEnvelopes(filter: { ontologyId: ... })`
- `searchMetaEnvelopes(ontology: String!, term: String!)` → use `metaEnvelopes(filter: { search: ... })`
- `updateEnvelopeValue(envelopeId: String!, newValue: JSON!)` — field-level update, no idiomatic replacement

If you see `storeMetaEnvelope` in Web3 Adapter code, that is the internal method name on `EVaultClient` and is correct in that context.

## HTTP endpoints

### GET /whois

```bash
curl http://localhost:4000/whois -H "X-ENAME: @user-a.w3id"
```

Returns:

```json
{
  "w3id": "@user-a.w3id",
  "evaultId": "@evault-identifier",
  "keyBindingCertificates": ["eyJhbGciOiJFUzI1NiIs...", "..."]
}
```

Certificates are ES256 JWTs signed by the Registry. Payload: `{ ename, publicKey, exp, iat }`. Valid 1 hour. Verify signature verification recipe in [protocols.md](protocols.md).

### GET /logs

Paginated envelope operation log. Query params: `limit` (default 20, max 100), `cursor`.

```bash
curl "http://localhost:4000/logs?limit=20" -H "X-ENAME: @user-a.w3id"
```

Response:

```json
{
  "logs": [
    {
      "id": "log-entry-id",
      "eName": "@user-a.w3id",
      "metaEnvelopeId": "meta-envelope-id",
      "envelopeHash": "sha256-hex",
      "operation": "create",             // create | update | delete | update_envelope_value
      "platform": "https://platform.example.com",
      "timestamp": "2025-02-04T12:00:00.000Z",
      "ontology": "550e8400-e29b-41d4-a716-446655440001"
    }
  ],
  "nextCursor": "2025-02-04T12:00:00.000Z|log-entry-id",
  "hasMore": true
}
```

URL-encode the cursor when following pagination — it contains `|`.

### GET /files/:metaEnvelopeId

Dereferences a `w3ds://file` URI. Returns a **302 redirect** to the public object-storage URL. Requires `X-ENAME`. See [protocols.md](protocols.md) for the URI scheme.

### PATCH /public-key

Wallet endpoint for key sync. Body: `{ publicKey }`. Headers: `X-ENAME` (required), `Authorization: Bearer <token>` (required). eVault stores the key and requests a fresh key-binding certificate from the Registry. See [wallet.md](wallet.md).

## Access control

Two models. `_acl` is current; the `acl` string array predates it and still works.

### `_acl` (granular)

An optional input field on `createMetaEnvelope`, `storeMetaEnvelope`, `bulkCreateMetaEnvelopes`, `updateMetaEnvelope`, `updateMetaEnvelopeById`, and `uploadFile`. Stored on the MetaEnvelope node as the `aclBlock` JSON property, so it travels with the record.

```
_acl: {
  v: 1,
  grants:  [ { ename: "@<uuid>", perms: 1 } ],   // u8 bitmask
  denials: { enames: ["@<uuid>"], conditions: [] },
  default_perms: 1,                              // unnamed parties that pass a group
  require: [ [ { ontology: "@<uuid>", path: "$.score", op: ">=", value: 60 } ] ]
}
```

Perms bitmask: `0x01` READ, `0x02` CREATE, `0x04` UPDATE, `0x08` DELETE. `0x0F` full, `0x03` read + add-only. Bits 4-7 reserved, must be 0 — a write that sets them is rejected. `0x00` counts as no grant.

Readable back: `MetaEnvelope._acl` is exposed to anyone permitted to read the record, and always reports the policy in force — a record with only a legacy array reports the block that array maps to. The legacy `acl` array itself is never returned.

Decision order, fixed: (1) denials — by eName or a **failing** condition — always win; (2) the single most specific grant (user > platform > group, no union across specificity) decides on its own; (3) otherwise a passing `require` group admits at `default_perms`. `require` is an OR of groups, each an AND of conditions; an empty group always passes.

Never guess these: a missing/multi-valued/non-numeric condition path **fails**, never passes. A named party never falls through from step 2 to step 3.

### Legacy `acl` array

- `["*"]` — anyone can read; only the eVault owner can write.
- `["@user-a.w3id"]` — user A can read AND write.

All-or-nothing: no read-only-without-write except `["*"]`. Where a record has `_acl`, the array is ignored entirely; where it does not, the array behaves exactly as before.

Access enforcement flow:

1. Extract W3ID from `X-ENAME` header or Bearer token.
2. If the record carries `_acl`, decide by it, against the permission the operation needs. Otherwise check the requester's W3ID against the legacy array.
3. Strip the legacy `acl` array from the response; `_acl` is returned.
4. Grant or deny.

A valid platform Bearer token satisfies the legacy path but does **not** bypass an `_acl` policy.

**`X-ON-BEHALF-OF`** — optional header naming the user eName a platform is acting for. That user becomes the party (at user specificity) with the platform recorded alongside it; without it the platform is the party. It is the platform's assertion, not a proof, so it can reach what the user was granted — but it cannot escape a denial, since denials match the carrying platform too. Only `@`-prefixed eNames are accepted as parties; a JWT `kid` is not.

**Groups.** A grant or denial may name a group eName; it resolves to member eNames at decision time. The group record is found in the group's own vault or by its `ename` field, and participants are read from `members`, `memberIds`, `participants`, `participantIds`, `admins`, `owner` (unioned — admins and owner count). Each entry is **either an eName or a profile record's id**; an id resolves via that record's `ename` field, else the vault it lives in. Never assume one form.

Undeterminable membership is not "not a member": a grant needs proof and is withheld, a denial stands until non-membership is shown. With no resolver configured, groups match nobody at all.

Not yet wired: no condition evaluator is connected, so any `require` group containing conditions fails closed. Write policies using `grants`, `denials.enames`, group enames, and empty-group `require`. Full model: `docs/docs/W3DS Protocol/Access-Control.md`.

Special cases:

- `storeMetaEnvelope` (legacy `createMetaEnvelope` alias): requires only `X-ENAME`, no Bearer token.
- `["*"]`: any authenticated request can read.
- Bulk create requires a Bearer token in addition to `X-ENAME`.

## Webhook delivery (Awareness Protocol)

After a `createMetaEnvelope` (or legacy `storeMetaEnvelope`), eVault:

1. Persists to Neo4j.
2. Waits **3 seconds** (create only — `updateMetaEnvelope` fires immediately).
3. `GET /platforms` on the Registry → list of platform base URLs.
4. Filters out the requesting platform (identified from the Bearer token's `platform` claim, URL-normalized).
5. `POST /api/webhook` on every remaining platform in parallel. 5s timeout per call. No retries. Fire-and-forget.

Payload:

```json
{
  "id": "a1b2c3d4-...",
  "w3id": "@user-a.w3id",
  "schemaId": "550e8400-e29b-41d4-a716-446655440001",
  "data": {
    "content": "Hello, world!",
    "mediaUrls": [],
    "authorId": "@e4d909c2-...",
    "createdAt": "2025-01-24T10:00:00Z"
  },
  "evaultPublicKey": "z..."
}
```

For the receiving side (writing a `/api/webhook` handler), see [platform.md](platform.md).

## Key binding certificates

- Stored in the eVault, retrieved via `/whois`.
- Issued by the Registry as ES256 JWTs. Payload: `{ ename, publicKey, exp, iat }`. TTL 1 hour.
- Purpose: (a) tamper protection over the wire, (b) Registry accountability for W3ID↔publicKey binding.
- Lifecycle: created during eVault provisioning if `publicKey` was included; refreshed on `PATCH /public-key`.
- Multi-device: one certificate per key. Verifier iterates and returns success on the first match.

## Multi-tenancy

The Provisioner supports multiple W3IDs sharing infrastructure, but each eVault instance is dedicated to a single tenant. Database queries are always filtered by W3ID; there is no cross-tenant read except through ACLs.

## References in the docs

- Full spec: `docs/docs/Infrastructure/eVault.md`
- Data model + ontology field semantics: `docs/docs/Infrastructure/Ontology.md`
- Webhook packet + delivery mechanics: `docs/docs/W3DS Protocol/Awareness-Protocol.md`
- Key binding certificate detail: `docs/docs/Infrastructure/eVault-Key-Delegation.md`
