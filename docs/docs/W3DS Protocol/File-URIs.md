---
sidebar_position: 5
---

# File URIs

This document explains the `w3ds://file` URI scheme — a standardised,
human-readable way to reference and dereference files across the MetaState
ecosystem. A file attached to or described by a [Meta Envelope](/docs/Infrastructure/eVault)
can be uniquely addressed and resolved with a consistent URI tied to a user's
entity name (`ename`) and the envelope's identifier.

## Format

```text
w3ds://file?id=@<user-ename>/<meta-envelope-id>
```

| Component            | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `w3ds://`            | The scheme. Always lowercase.                                |
| `file`               | The resource host. Identifies the URI as addressing a file.  |
| `id`                 | Required query parameter carrying the file's address.        |
| `@<user-ename>`      | The owning user's entity name (`ename`), always `@`-prefixed.|
| `<meta-envelope-id>` | The ID of the Meta Envelope describing the file.             |

Example:

```text
w3ds://file?id=@alice/envelope-abc123
```

## How files are stored

A file uploaded to an [eVault](/docs/Infrastructure/eVault) is:

1. Streamed to object storage (DigitalOcean Spaces, S3-compatible) as a
   `public-read` object.
2. Recorded as a **File Meta Envelope** (ontology `w3ds-file-v1`) with payload:
   `{ filename, contentType, size, blobKey, publicUrl, uploadedAt }`.
3. Addressed by a `w3ds://file` URI built from the owner `ename` and the
   Meta Envelope ID.

Uploads are performed through the eVault `uploadFile` GraphQL mutation, which
takes base64 content and returns the `w3ds://file` URI, the Meta Envelope ID,
and the public object-storage URL.

## The `uploadFile` mutation

```graphql
uploadFile(input: UploadFileInput!): UploadFilePayload!
```

Uploads a file to object storage and creates an addressable **File Meta
Envelope** (ontology `w3ds-file-v1`). The request **must** carry an
`X-ENAME: @<user-ename>` header — uploads are rejected without it. Object
storage must be configured on the eVault (DigitalOcean Spaces / S3-compatible);
otherwise the mutation returns an error.

### Input — `UploadFileInput`

| Field         | Type        | Description                                                          |
| ------------- | ----------- | -------------------------------------------------------------------- |
| `filename`    | `String!`   | Original file name.                                                  |
| `contentType` | `String!`   | MIME type of the file.                                               |
| `content`     | `String!`   | Base64-encoded file content — raw base64 **or** a `data:` URI.       |
| `acl`         | `[String!]!`| Access-control list for the created File Meta Envelope (e.g. `["*"]`).|

Constraints: content must be valid base64 (malformed input is rejected) and the
decoded size must not exceed **50 MB**.

### Payload — `UploadFilePayload`

| Field            | Type           | Description                                                       |
| ---------------- | -------------- | ----------------------------------------------------------------- |
| `uri`            | `String`       | The `w3ds://file` URI addressing the upload; `null` on error.     |
| `metaEnvelopeId` | `String`       | ID of the File Meta Envelope describing the upload.               |
| `publicUrl`      | `String`       | Public object-storage URL of the file.                            |
| `errors`         | `[UserError!]` | Errors that occurred during the upload (`field`, `message`, `code`).|

### Stored Meta Envelope payload

The mutation persists a Meta Envelope with ontology `w3ds-file-v1` and payload:

```json
{ "filename", "contentType", "size", "blobKey", "publicUrl", "uploadedAt" }
```

where `size` is the decoded byte length, `blobKey` is the object-storage key
(`files/{owner}/{id}-{filename}`), and `uploadedAt` is an ISO-8601 timestamp.

> **Note:** this `w3ds-file-v1` storage envelope is **not** the same as the
> platform-level `File` ontology (`a1b2c3d4-e5f6-7890-abcd-ef1234567890`). See
> [File ontology vs. `w3ds-file-v1`](#file-ontology-vs-w3ds-file-v1) below.

### Example

```graphql
mutation UploadFile($input: UploadFileInput!) {
  uploadFile(input: $input) {
    uri
    metaEnvelopeId
    publicUrl
    errors { field message code }
  }
}
```

```json
{
  "input": {
    "filename": "contract.pdf",
    "contentType": "application/pdf",
    "content": "data:application/pdf;base64,JVBERi0x...",
    "acl": ["*"]
  }
}
```

On failure after the blob is written, the orphaned object is deleted
(compensating cleanup), so a failed upload leaves no dangling storage object.

## Resolving (dereferencing) a URI

There are two dereferencers.

### HTTP — eVault core

```http
GET /files/:metaEnvelopeId        (header: X-ENAME: @<user-ename>)
```

Resolves the File Meta Envelope and responds with a **302 redirect** to the
file's public object-storage URL. The redirect target is validated to be
`http(s)` only.

- `400` — missing `X-ENAME` header, malformed ID, or an unsafe stored URL scheme.
- `404` — no File Meta Envelope for that ID, or it has no public URL.

### Programmatic — web3-adapter

```ts
import { dereferenceFileUri } from "@web3-adapter/w3ds/resolver";

const file = await dereferenceFileUri(
  "w3ds://file?id=@alice/abc123",
  evaultClient,
);
// => { uri, ename, metaEnvelopeId, publicUrl, filename, contentType, size }
```

## Error handling

`parseFileUri` / `dereferenceFileUri` throw a descriptive `InvalidW3dsUriError`
or `Error` for:

- Malformed URIs (not parseable, empty input).
- Wrong scheme (not `w3ds:`) or wrong host (not `file`).
- Missing `id` query parameter.
- `id` missing the `@<ename>` prefix or the `/<meta-envelope-id>` segment.
- Empty `ename` or `meta-envelope-id`.
- A non-existent `ename` (eVault cannot be resolved).
- A non-existent or non-file Meta Envelope.

## File ontology vs. `w3ds-file-v1`

There are **two distinct file schemas** in the system. They are easy to confuse
but serve different layers, and conflating them is a common source of bugs.

| | `w3ds-file-v1` | `File` ontology |
| --- | --- | --- |
| **Identifier** | `w3ds-file-v1` (string) | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (UUID) |
| **Created by** | `uploadFile` mutation, at upload time | Platform apps (file-manager, esigner) via the Web3 Adapter mapping |
| **Layer** | Storage / transport — describes a blob in object storage | Application domain — a file record in a platform's database |
| **Payload** | `filename`, `contentType`, `size`, `blobKey`, `publicUrl`, `uploadedAt` | `id`, `name`, `displayName`, `description`, `mimeType`, `size`, `md5Hash`, `data`, `url`, `ownerId`, `folderId`, `createdAt`, `updatedAt` |
| **Addressed by** | `w3ds://file?id=@ename/<meta-envelope-id>` | Synced as a normal Meta Envelope through platform mappings |
| **Defined in** | `evault-core/src/core/utils/w3ds-uri.ts` (`FILE_SCHEMA_ID`) | `services/ontology/schemas/file.json` |

**They are not the same envelope.** The payload documented above
(`{ filename, contentType, size, blobKey, publicUrl, uploadedAt }`) belongs to
`w3ds-file-v1` only — it is the low-level record the `uploadFile` mutation
creates so a blob can be dereferenced via a `w3ds://file` URI.

The `File` ontology (`a1b2c3d4-...`) is a higher-level platform concept: a
file-manager/esigner record with folders, owners, display names and an MD5
hash, mapped to/from the global layer by the Web3 Adapter (see
`platforms/file-manager/api/src/web3adapter/mappings/file.mapping.json`). Note
the field names differ — e.g. `name` vs `filename`, `mimeType` vs
`contentType`, `url` vs `publicUrl`/`blobKey` — so they are **not**
interchangeable payloads.

In short: use `w3ds-file-v1` + `w3ds://file` URIs to store and dereference raw
blobs; use the `File` ontology when modelling a platform's file records. A
single user-facing "file" may involve both — a `File` ontology record whose
`url` points at a blob uploaded via `uploadFile`.

## Mapper integration

The [Web3 Adapter](/docs/Infrastructure/Web3-Adapter) exposes a `__file()`
mapping directive that automatically references files on `toGlobal` and
dereferences them on `fromGlobal`. See
[Mapping Rules → File Referencing](/docs/Post%20Platform%20Guide/mapping-rules).
