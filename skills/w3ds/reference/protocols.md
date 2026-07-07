# W3DS protocols

Four wire-level protocols to know: `w3ds://auth`, `w3ds://sign`, the Awareness Protocol (webhooks), and `w3ds://file` URIs. Plus signature verification, which is shared by auth and sign. Source: `docs/docs/W3DS Protocol/*.md`.

## w3ds://auth (authentication)

Signature-based, passwordless login. The user's eID Wallet signs a session ID the platform generated. The platform verifies the signature via the Registry + eVault.

### URI format

```text
w3ds://auth?redirect={callback}&session={sessionId}&platform={platformName}
```

- `redirect` — URL-encoded callback endpoint where the wallet POSTs the signed result.
- `session` — cryptographically random session ID (128-bit; UUIDv4 in practice).
- `platform` — display name.

### Platform endpoints

**`GET /api/auth/offer`** — issue the URI:

```typescript
getOffer = async (req: Request, res: Response) => {
  const url = new URL("/api/auth", process.env.PUBLIC_BASE_URL).toString();
  const session = uuidv4();
  const offer = `w3ds://auth?redirect=${url}&session=${session}&platform=YOUR_PLATFORM`;
  res.json({ uri: offer });
};
```

Store `session` for 5 minutes to validate one-time-use. Response shape used by different platforms varies: eCurrency-api returns `{ offer, sessionId }`; Blabsy returns `{ uri: offer }`. Match your platform's client.

**`POST /api/auth`** — receive the signed session and verify:

Request body:

```json
{
  "w3id": "@user-a.w3id",
  "session": "550e8400-e29b-41d4-a716-446655440000",
  "signature": "xK3vJZQ2...==",
  "appVersion": "0.4.0"
}
```

Verification uses the `signature-validator` package (workspace):

```typescript
import { verifySignature } from "signature-validator";

const verificationResult = await verifySignature({
  eName:            w3id,
  signature:        signature,
  payload:          session,
  registryBaseUrl:  process.env.PUBLIC_REGISTRY_URL,
});

if (!verificationResult.valid) {
  return res.status(401).json({ error: "Invalid signature", message: verificationResult.error });
}
```

On success: mint your platform's session (JWT or cookie). On failure: 401.

### appVersion

Temporary field (will be sunset). Present because some early wallets signed differently. If you enforce it, use semver-compare against a minimum (e.g. `"0.4.0"`) and return 400 if too old. Delete this check once rollout completes.

### Security

- Session IDs must be cryptographically random (128 bits).
- One-time use; reject duplicates.
- Expire in ≤ 5 minutes.
- Return generic errors; never leak "user not found" vs "signature invalid".

Detail: `docs/docs/W3DS Protocol/Authentication.md`.

## w3ds://sign (arbitrary signatures)

Same session-signing shape as auth, but for signing documents, votes, references, approvals, etc.

### URI format

```text
w3ds://sign?session={sessionId}&data={base64Data}&redirect_uri={encodedCallback}
```

- `data` — base64-encoded JSON `{ message, sessionId, ...context }`. Displayed to the user by the wallet.
- The wallet still signs only the **session ID**, never the full data. The platform uses the sessionId to look up the stored context.

### Platform flow

1. Platform receives sign request from client, generates sessionId, builds `data`, base64-encodes it, stores session with 15-minute TTL.
2. Returns `{ sessionId, qrData, expiresAt }` to the client for QR rendering.
3. User scans; wallet decodes `data`, shows message, requests confirmation.
4. Wallet POSTs to `redirect_uri`:

```json
{
  "sessionId": "550e8400-...",
  "signature": "xK3vJZQ2...==",
  "w3id":      "@user-a.w3id",
  "message":   "550e8400-..."     // same as sessionId — for verification
}
```

5. Platform validates, verifies signature with `verifySignature(...)` using `message` as the `payload`, then processes the action and marks the session `completed` (or `security_violation`).

Detail: `docs/docs/W3DS Protocol/Signing.md`.

## Awareness Protocol (webhooks)

Prototype-level fanout from eVault-core to every registered platform after a write. Fire-and-forget. Source: `docs/docs/W3DS Protocol/Awareness-Protocol.md`.

### When it fires

- After `createMetaEnvelope` (legacy `storeMetaEnvelope`): **3-second delay**, then fanout. The delay gives eVault time to reliably identify the requesting platform (from the Bearer token's `platform` claim) so it can exclude that platform from the fanout list. Without the delay you get "webhook ping-pong."
- After `updateMetaEnvelope` (legacy `updateMetaEnvelopeById`): **immediate** fanout.

### Delivery mechanics

1. eVault `GET /platforms` on the Registry → list of platform base URLs.
2. Filter out the requesting platform (normalized URL compare).
3. `POST {platformUrl}/api/webhook` on each remaining platform in parallel.
4. 5-second timeout per call.
5. `Promise.allSettled` — one failure does not affect others.
6. No retries. Failures are logged but do not block the mutation.

### Packet format

```json
{
  "id":        "a1b2c3d4-...",
  "w3id":      "@e4d909c2-...",
  "schemaId":  "550e8400-e29b-41d4-a716-446655440001",
  "data": {
    "content":   "Hello, world!",
    "mediaUrls": [],
    "authorId":  "@e4d909c2-...",
    "createdAt": "2025-01-24T10:00:00Z"
  }
}
```

Every platform receives every packet (broadcast). It is the platform's responsibility to inspect `schemaId` and drop packets it doesn't consume. A future revision will support ontology subscriptions and by-reference delivery.

### Platform contract

Every platform participating in W3DS MUST implement `POST /api/webhook` and:

1. Find the mapping whose `schemaId` matches the packet's `schemaId`.
2. `adapter.fromGlobal({ data: body.data, mapping })` → local-shaped data.
3. Look up existing local ID for `body.id`; if found, update; otherwise create and persist the `(globalId, localId)` mapping.
4. Return 200.

**Idempotency required**: the same `body.id` may arrive more than once (network retries, misbehaving eVault). Never create a second local entity for the same global ID.

Full webhook controller code in [platform.md § Webhook controller](platform.md#webhook-controller).

### Limitations to know

- No retries. No ordering. No at-least-once guarantee.
- Recipient set = whatever `GET /platforms` returns. That is a prototype shortcut.

For production, use Awareness-as-a-Service.

### Awareness-as-a-Service (AaaS)

Production-grade replacement layer. Source: `docs/docs/Services/Awareness-as-a-Service.md`. Key differences vs raw Awareness Protocol:

- `POST /ingest` accepts packets from eVault-core.
- `GET /api/packets` — poll query with filters (ontology, eVault, time).
- Dynamic webhook subscriptions filtered by ontology or eVault.
- Retry engine with exponential backoff (30s → 24h).
- Dead-letter queue for permanently-failed deliveries.
- W3DS-authenticated public portal.

Undifferentiated fanout → targeted delivery; no history → queryable; ungoverned access → access-controlled.

## Signature formats

Source: `docs/docs/W3DS Protocol/Signature-Formats.md`.

### The algorithm

Always **ECDSA P-256 (secp256r1) with SHA-256**. Payload is UTF-8 encoded, SHA-256'd (32 bytes), signed → 64 bytes raw `(r || s)`, each half 32 bytes.

### Encodings on the wire

| Origin | Encoding | Prefix |
|---|---|---|
| **Software keys** | Base64 of raw 64 bytes | none |
| **Hardware keys** (Passkey / Secure Enclave / HSM) | Multibase base58btc of DER-encoded ECDSA-Sig | `z` |

Auto-detection at verify time:

- Starts with `z` → multibase base58btc → decode → may be DER (starts with `0x30`, SEQUENCE) → normalize to raw 64 bytes.
- Starts with `m` → multibase base64 (no padding).
- Starts with `f` → hex, lowercase.
- Else → standard base64 / base64url.

The `signature-validator` package handles all of this — you don't need to detect manually. Detection matters when you're implementing verification yourself.

### Public key formats

Multibase-encoded. Same prefix system:

- `z` — base58btc
- `m` — base64, no padding
- `f` — hex, lowercase

Content after decoding is one of:

- **SPKI DER** — DER-encoded SubjectPublicKeyInfo (most common — what `crypto.subtle.exportKey('spki', ...)` emits).
- **Raw uncompressed** — 65 bytes: `0x04` + 32-byte X + 32-byte Y.

Both are accepted by the verifier.

## Signature verification recipe

Full verification is a 5-step process. Use the `signature-validator` package unless you have a strong reason to reimplement.

1. **Resolve eVault URL**: `GET {registryBaseUrl}/resolve?w3id=@user.w3id` → `{ uri }`.
2. **Fetch key binding certificates**: `GET {evaultUri}/whois` with header `X-ENAME: @user.w3id` → `{ keyBindingCertificates: [<JWT>, ...] }`.
3. **Fetch Registry JWKS**: `GET {registryBaseUrl}/.well-known/jwks.json`.
4. **For each certificate**:
   - Parse the JWT header/payload/signature.
   - Verify JWT with the JWKS key matching `kid`.
   - Check `exp` is in the future.
   - Extract `publicKey` from the JWT payload (multibase-encoded).
   - Decode the multibase public key.
5. **Verify the ECDSA signature**: import the decoded key, hash the payload with SHA-256, verify with ECDSA P-256. Return success on the first cert that verifies.

The multi-cert loop handles multi-device users (each device has its own key). Any cert succeeding is enough.

Using the SDK:

```typescript
import { verifySignature } from "signature-validator";

const result = await verifySignature({
  eName:           "@user.w3id",
  signature:       "z3K7vJZQ2F3k5L8mN9pQrS7tUvW1xY3zA5bC7dE9fG1hIjKlMnOpQrStUvWxYz",
  payload:         "550e8400-e29b-41d4-a716-446655440000",
  registryBaseUrl: "https://registry.w3ds.metastate.foundation",
});

// result: { valid: boolean, error?: string, publicKey?: string }
```

## File URIs (`w3ds://file`)

Standard URI scheme for referencing blobs. Source: `docs/docs/W3DS Protocol/File-URIs.md`.

### Format

```text
w3ds://file?id=@<user-ename>/<meta-envelope-id>
```

Example: `w3ds://file?id=@alice/envelope-abc123`.

### Storage layer

Files uploaded via the eVault `uploadFile` mutation:

1. Blob streamed to S3-compatible object storage (DigitalOcean Spaces) as `public-read`.
2. A **File Meta Envelope** is recorded with ontology `w3ds-file-v1`. Payload:

```json
{ "filename", "contentType", "size", "blobKey", "publicUrl", "uploadedAt" }
```

3. The `w3ds://file` URI is built from the owner ename and the File Meta Envelope ID.

Max size 50 MB decoded. `uploadFile` API signature in [evault.md § File upload](evault.md#file-upload).

### Dereferencing

**HTTP (eVault-core):**

```http
GET {evaultUrl}/files/:metaEnvelopeId
X-ENAME: @<owner-ename>
```

Returns HTTP 302 redirect to the file's public object-storage URL. Only `http(s)` scheme allowed in the target. 400 on missing X-ENAME, malformed ID, or unsafe scheme. 404 on missing envelope or missing `publicUrl`.

**Programmatic (Web3 Adapter):**

```ts
import { dereferenceFileUri } from "@web3-adapter/w3ds/resolver";

const file = await dereferenceFileUri(
  "w3ds://file?id=@alice/abc123",
  evaultClient,
);
// { uri, ename, metaEnvelopeId, publicUrl, filename, contentType, size }
```

`parseFileUri` / `dereferenceFileUri` throw `InvalidW3dsUriError` on malformed URIs, wrong scheme, missing `id`, missing `@`, or non-existent ename / non-file envelope.

### `w3ds-file-v1` vs `File` ontology — do not confuse

Two distinct schemas. Conflating them is a common source of bugs.

| | `w3ds-file-v1` | `File` ontology |
|---|---|---|
| Identifier | `w3ds-file-v1` (string literal) | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (UUID) |
| Created by | `uploadFile` mutation | Platform apps (file-manager, esigner) via Web3 Adapter mapping |
| Layer | Storage / transport — describes a blob | Application domain — a file record in a platform DB |
| Payload keys | `filename`, `contentType`, `size`, `blobKey`, `publicUrl`, `uploadedAt` | `id`, `name`, `displayName`, `description`, `mimeType`, `size`, `md5Hash`, `data`, `url`, `ownerId`, `folderId`, `createdAt`, `updatedAt` |
| Addressed by | `w3ds://file?id=@ename/<meta-envelope-id>` | Normal MetaEnvelope, synced through mapping |
| Schema location | `evault-core/src/core/utils/w3ds-uri.ts` (`FILE_SCHEMA_ID`) | `services/ontology/schemas/file.json` |

A user-facing file may involve both: a `File` ontology record whose `url` points at a blob uploaded via `uploadFile`.

### Mapper integration

The Web3 Adapter's `__file(...)` mapping directive automatically calls `uploadFile` on `toGlobal` (replaces a `data:` URI or file value with a `w3ds://file` URI) and `dereferenceFileUri` on `fromGlobal` (replaces the URI with the public URL). Detail in [platform.md § Mapping directives](platform.md#mapping-directives).

## References in the docs

- Authentication: `docs/docs/W3DS Protocol/Authentication.md`
- Signing: `docs/docs/W3DS Protocol/Signing.md`
- Signature formats: `docs/docs/W3DS Protocol/Signature-Formats.md`
- Awareness Protocol: `docs/docs/W3DS Protocol/Awareness-Protocol.md`
- File URIs: `docs/docs/W3DS Protocol/File-URIs.md`
- Awareness-as-a-Service: `docs/docs/Services/Awareness-as-a-Service.md`
