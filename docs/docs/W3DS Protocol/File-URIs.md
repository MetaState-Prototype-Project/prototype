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

## Mapper integration

The [Web3 Adapter](/docs/Infrastructure/Web3-Adapter) exposes a `__file()`
mapping directive that automatically references files on `toGlobal` and
dereferences them on `fromGlobal`. See
[Mapping Rules → File Referencing](/docs/Post%20Platform%20Guide/mapping-rules).
