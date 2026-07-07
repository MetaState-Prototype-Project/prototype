# Identity — W3ID, eName, Binding Documents

W3IDs identify every user, group, eVault, and MetaEnvelope in the ecosystem. An eName is a W3ID that has been registered in the Registry and is therefore resolvable to a service URL. Source: `docs/docs/W3DS Basics/W3ID.md`, `eName.md`, `Binding-Documents.md`.

## W3ID

UUID-based (RFC 4122), persistent, globally unique. Two forms:

| Form | Format | Example | Use |
|---|---|---|---|
| **Global** (eName) | `@<UUID>` | `@e4d909c2-5d2f-4a7d-9473-b34b6c0f1a5a` | Cross-platform identity, ACLs, X-ENAME header |
| **Local** | plain `<UUID>` | `f2a6743e-8d5b-43bc-a9f0-1c7a3b9e90d7` | Object identifier within one eVault |

Namespace has range 2^122 (from UUID); collision probability is negligible. Global IDs are case-insensitive.

Key property: **loosely bound to keys**. The W3ID is not derived from any key, which is what enables:

- **Key rotation** without changing identity (key compromise, device loss).
- **Friend-based recovery** — a trust list (2–3 friends or notaries) can approve key changes.
- **eVault migration** — the Registry can hold also-known-as / redirect records so an old W3ID still resolves after a move.

## eName vs W3ID

Every eName is a W3ID. Only W3IDs registered in the Registry are eNames.

| | W3ID (unregistered) | eName |
|---|---|---|
| Format | `@<UUID>` | `@<UUID>` |
| Resolvable via Registry | No | Yes |
| Used in `X-ENAME` header | No | Yes |
| Primary role | Local identifier | Cross-platform identity |

If you're building a platform, users and groups you interact with will always have eNames — never bare W3IDs.

## X-ENAME header

Required on every eVault GraphQL / HTTP request:

```http
X-ENAME: @e4d909c2-5d2f-4a7d-9473-b34b6c0f1a5a
```

Determines: which eVault to route the request to, ACL enforcement, log ownership. Missing header = 400.

## Where W3IDs / eNames appear

- **Users, groups**: each has a persistent eName that anchors keys and (via binding documents) physical identity.
- **eVaults**: an eVault has its own internal W3ID (used for clone sync). The owner's eName identifies the "owner" for ACL / whois purposes.
- **MetaEnvelopes**: `id` is a W3ID. Ownership is by the eVault whose owner-eName was in `X-ENAME` at creation time.
- **ACLs**: arrays of eNames (or `["*"]`). See [evault.md](evault.md#access-control).
- **Key binding certificates**: JWTs whose payload binds an eName to a public key.

## Binding Documents

A Binding Document is a special MetaEnvelope (ontology `b1d0a8c3-4e5f-6789-0abc-def012345678`) that ties a subject eName to a real-world credential or claim. Every binding document has:

- `subject` — the eName being bound (with `@` prefix)
- `type` — one of `id_document | photograph | social_connection | self`
- `data` — type-specific payload
- `signatures[]` — at least the owner's signature; counterparty signatures appendable

Signature shape:

```typescript
interface BindingDocumentSignature {
  signer: string;      // eName or keyID of who signed
  signature: string;   // Cryptographic signature (base64 or multibase)
  timestamp: string;   // ISO 8601
}
```

### Types + data shapes

**id_document** — binds eName to a KYC-verified ID document:

```json
{ "vendor": "onfido", "reference": "ref-12345", "name": "John Doe" }
```

**photograph** — binds eName to a selfie / profile photo:

```json
{ "photoBlob": "base64encodedimage==" }
```

**social_connection** — binds two eNames to a claimed relationship:

```json
{
  "kind": "social_connection",
  "name": "Alice Smith",
  "parties": ["@ename-1", "@ename-2"],
  "relation_description": "Known each other since university"
}
```

`parties` must be exactly two eNames. `kind` is a required discriminator.

**self** — user's self-declared identity:

```json
{ "name": "Bob Jones" }
```

### Storage

- MetaEnvelope ID = binding document ID (no separate id field on the document itself).
- ACL is restricted to the subject's eName by default.
- Stored in the subject's own eVault (their eName owns the MetaEnvelope).

### GraphQL operations

See the full mutations and queries in [evault.md § Binding documents](evault.md#binding-documents). Key idea: use `createBindingDocument` to create with the owner signature, then `createBindingDocumentSignature` to append counterparty signatures for chain-of-trust verification.

## Document binding to physical identity

The W3ID system supports binding an identity to a passport or other physical document via a certified binding document. Passport verification itself is out of scope for W3ID — it's handled by the eID Wallet's verification integrations. The binding is loose (entropy derived from passport details, certified by a root CA) so the identity survives passport renewal.

## References in the docs

- W3ID spec: `docs/docs/W3DS Basics/W3ID.md`
- eName vs W3ID: `docs/docs/W3DS Basics/eName.md`
- Binding document types + operations: `docs/docs/W3DS Basics/Binding-Documents.md`
- ACL semantics: `docs/docs/Infrastructure/eVault.md` (§ Access Control)
- Key binding certificates: `docs/docs/Infrastructure/eVault-Key-Delegation.md`
