# The `w3ds://file` URI Scheme

A standardised, human-readable URI scheme for referencing and dereferencing
files within the MetaState ecosystem.

## Format

```
w3ds://file?id=@<user-ename>/<meta-envelope-id>
```

| Component          | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `w3ds://`          | The scheme. Always lowercase.                                      |
| `file`             | The resource host. Identifies the URI as addressing a file.        |
| `id`               | Required query parameter carrying the file's address.              |
| `@<user-ename>`    | The owning user's entity name (`ename`), always `@`-prefixed.      |
| `<meta-envelope-id>` | The ID of the Meta Envelope describing the file.                 |

Example:

```
w3ds://file?id=@alice/envelope-abc123
```

## How files are stored

A file uploaded to eVault is:

1. Streamed to object storage (DigitalOcean Spaces, S3-compatible) as a
   `public-read` object.
2. Recorded as a **File Meta Envelope** (ontology `w3ds-file-v1`) with payload:
   `{ filename, contentType, size, blobKey, publicUrl, uploadedAt }`.
3. Addressed by a `w3ds://file` URI built from the owner `ename` and the
   Meta Envelope ID.

## Constructing a URI

The eVault `uploadFile` GraphQL mutation returns the `w3ds://file` URI directly.
In the web3-adapter:

```ts
import { buildFileUri } from "./w3ds/uri";

buildFileUri({ ename: "@alice", metaEnvelopeId: "abc123" });
// => "w3ds://file?id=@alice/abc123"
```

## Resolving (dereferencing) a URI

There are two dereferencers:

### HTTP — eVault core

```
GET /files/:metaEnvelopeId        (header: X-ENAME: @<user-ename>)
```

Resolves the File Meta Envelope and responds with a **302 redirect** to the
file's public object-storage URL.

- `400` — missing `X-ENAME` header or malformed ID.
- `404` — no File Meta Envelope for that ID, or it has no public URL.

### Programmatic — web3-adapter

```ts
import { dereferenceFileUri } from "./w3ds/resolver";

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

The web3-adapter mapper exposes a `__file()` directive that automatically
references files on `toGlobal` and dereferences them on `fromGlobal`. See
[`MAPPING_RULES.md`](./MAPPING_RULES.md#file-referencing-__file).
