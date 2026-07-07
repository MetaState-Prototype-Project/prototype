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

`UploadFileInput`: `filename` (string), `contentType` (string, MIME), `content` (base64 or `data:` URI), `acl` (array). Decoded size must be ≤ 50 MB. Requires `X-ENAME` and object storage configured on the eVault. Detail on the `w3ds://file` scheme → [protocols.md](protocols.md).

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

ACLs are string arrays on each MetaEnvelope:

- `["*"]` — anyone can read; only the eVault owner can write.
- `["@user-a.w3id"]` — user A can read AND write.
- `["@user-a.w3id", "@user-b.w3id"]` — both can read and write.

Prototype limitation: no read-only-without-write except for `["*"]`. Fine-grained perms are on the roadmap.

Access enforcement flow:

1. Extract W3ID from `X-ENAME` header or Bearer token.
2. Check requester's W3ID is in the ACL.
3. Strip the ACL field from the response (security).
4. Grant or deny.

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
