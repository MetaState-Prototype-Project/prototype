# Building a post-platform

This is the primary developer reference. A platform participating in W3DS needs four things: an auth flow, a webhook endpoint, JSON mapping files, and a Web3 Adapter wired to the local DB. Source: `docs/docs/Post Platform Guide/*.md`, `docs/docs/Infrastructure/Web3-Adapter.md`.

## The four required pieces

| Piece | What | Reference doc |
|---|---|---|
| **Auth endpoints** | `GET /api/auth/offer` + `POST /api/auth`, using `signature-validator` | `docs/docs/Post Platform Guide/getting-started.md` |
| **Webhook endpoint** | `POST /api/webhook` — idempotent, uses `adapter.fromGlobal` + mapping DB | `docs/docs/Post Platform Guide/webhook-controller.md` |
| **Mapping files** | JSON per local table describing the global schema mapping | `docs/docs/Post Platform Guide/mapping-rules.md` |
| **Web3 Adapter** | Instance holding the mapping configs, mapping DB, and eVault client; call `handleChange(...)` after every DB write | `docs/docs/Infrastructure/Web3-Adapter.md` |

If your app is stateless — writes directly to eVaults and doesn't own a local DB — you can skip the Web3 Adapter entirely. Adapter is only needed when a platform DB has to stay in sync with eVaults.

## Auth flow

### `GET /api/auth/offer`

Generate a session, build a `w3ds://auth` URI, return it (and the sessionId if your client needs it):

```typescript
getOffer = async (req: Request, res: Response) => {
  const url = new URL("/api/auth", process.env.PUBLIC_BASE_URL).toString();
  const sessionId = uuidv4();
  const offer = `w3ds://auth?redirect=${url}&session=${sessionId}&platform=YOUR_PLATFORM`;
  res.json({ offer, sessionId });
};
```

Persist `sessionId` with a 5-minute TTL — reject reuse to prevent replays.

### `POST /api/auth`

The wallet POSTs the signed session here:

```typescript
import { verifySignature } from "signature-validator";
import { signToken } from "../utils/jwt";

login = async (req: Request, res: Response) => {
  const { w3id, session, signature, appVersion } = req.body;

  if (!w3id || !session || !signature) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const verificationResult = await verifySignature({
    eName:            w3id,
    signature,
    payload:          session,
    registryBaseUrl:  process.env.PUBLIC_REGISTRY_URL,
  });

  if (!verificationResult.valid) {
    return res.status(401).json({ error: "Invalid signature", message: verificationResult.error });
  }

  // Users must exist before login. They are created by your webhook handler
  // when the User ontology (550e8400-...440000) MetaEnvelope arrives.
  const user = await this.userService.findByEname(w3id);
  if (!user) {
    return res.status(404).json({ error: "User not found", message: "User must be created via eVault webhook before authentication" });
  }

  const token = signToken({ userId: user.id });
  res.status(200).json({ user, token });
};
```

Guard protected routes with `authMiddleware` + `authGuard`:

```typescript
export const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try {
    const { userId } = verifyToken(authHeader.substring(7));
    const user = await userService.getUserById(userId);
    if (user) req.user = user;
  } catch { /* invalid token — continue unauthenticated */ }
  next();
};

export const authGuard = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  next();
};
```

Env vars: `JWT_SECRET`, `PUBLIC_REGISTRY_URL`. Detail in [protocols.md § w3ds://auth](protocols.md#w3dsauth-authentication).

## Webhook controller

`POST /api/webhook`. Receives Awareness Protocol packets from every eVault whenever data changes anywhere. Contract:

1. Find the mapping by `schemaId`.
2. `fromGlobal(...)` → local shape.
3. Look up (or create) the local ID for the packet's global `id`.
4. Persist the mapping.
5. Return 200.

Reference implementation (adapted from eCurrency-api):

```typescript
handleWebhook = async (req: Request, res: Response) => {
  const globalId = req.body.id;
  const schemaId = req.body.schemaId;

  try {
    const mapping = Object.values(this.adapter.mapping).find(
      (m: any) => m.schemaId === schemaId,
    );
    if (!mapping) throw new Error("No mapping found");

    const local = await this.adapter.fromGlobal({ data: req.body.data, mapping });

    let localId = await this.adapter.mappingDb.getLocalId(globalId);

    if (mapping.tableName === "users") {
      const entity = localId
        ? await this.userService.updateUser(localId, local)
        : await this.userService.createUser(local);
      if (!localId) {
        await this.adapter.mappingDb.storeMapping({ localId: entity.id, globalId });
      }
    } else if (mapping.tableName === "groups") {
      // ... same pattern per entity type
    }

    res.status(200).send();
  } catch (e) {
    console.error("Webhook error:", e);
    res.status(500).send();
  }
};
```

Route registration:

```typescript
app.post("/api/webhook", webhookController.handleWebhook); // no auth on webhook
```

The endpoint receives packets for **every** ontology — you must filter and drop packets your platform doesn't consume.

**Idempotency is mandatory.** Same `globalId` may arrive more than once. Never create a second local row for the same global ID; always upsert.

Detail: `docs/docs/Post Platform Guide/webhook-controller.md`.

## Mapping directives

Mapping files describe how local table fields ↔ global ontology fields. Same file is used both directions: `toGlobal` for outbound sync, `fromGlobal` for inbound webhooks.

### File shape

```json
{
  "tableName":     "local_table_name",
  "schemaId":      "550e8400-...",
  "ownerEnamePath": "ename",
  "ownedJunctionTables": ["junction_table1"],
  "localToUniversalMap": {
    "localField":    "globalField",
    "localRelation": "tableName(relationPath),globalAlias"
  }
}
```

- `tableName` — local table / entity name.
- `schemaId` — global ontology W3ID (from [registry.md § Canonical ontology W3IDs](registry.md#canonical-ontology-w3ids)).
- `ownerEnamePath` — how to determine which eVault owns rows in this table. Supports fallbacks with `||`.
- `ownedJunctionTables` — for many-to-many relationships; when a junction row changes, the adapter re-syncs the parent.
- `readOnly` (optional) — when `true`, `handleChange` skips this table for outbound sync.
- `localToUniversalMap` — the field mapping.

### Directives (verbatim, from `docs/docs/Post Platform Guide/mapping-rules.md`)

**Direct field:**

```json
"localField": "globalField"
```

**Relation (single):**

```json
"localRelation": "tableName(relationPath),globalAlias"
```

- `tableName` — the referenced table.
- `relationPath` — path to the relation data on the local entity.
- `globalAlias` — target global field name.

**Relation (array):**

```json
"participants": "users(participants[].id),participantIds"
```

- `participants[].id` extracts `id` from each element of the local `participants` array.
- `users(...)` resolves each ID to a global user reference.
- `participantIds` is the target global field.

**Date conversion:**

```json
"createdAt": "__date(createdAt)"
"timestamp": "__date(calc(timestamp * 1000))"
```

Handles: Unix seconds (number), Firebase v8 `{_seconds}`, Firebase v9+ `{seconds}`, Firebase Timestamp objects, JS Date, UTC strings.

**Arithmetic:**

```json
"total":   "__calc(quantity * price)"
"average": "__calc((score1 + score2 + score3) / 3)"
```

Supports basic ops (`+ - * /`), references other fields on the same entity, auto-resolves referenced values first.

**File referencing (same global field name):**

```json
"avatar": "__file(avatar)"
```

**File referencing (different global field name):**

```json
"avatar": "__file(avatar),avatarUri"
```

Behavior:

- The inner path (`avatar`) is the field holding the file value.
- Optional `,alias` sets the global field (defaults to the inner path).
- Value may be a **single file** or an **array**. Array paths like `__file(images[].src)` are supported.
- `toGlobal`: `data:` URI → uploaded and replaced with `w3ds://file?id=@<ename>/<meta-envelope-id>`. Existing `w3ds://file` URIs, plain URLs, and empty values pass through.
- `fromGlobal`: `w3ds://file` URI → dereferenced to the public object-storage URL. Other values pass through.

Detail on the URI scheme: [protocols.md § File URIs](protocols.md#file-uris-w3dsfile).

### `ownerEnamePath` patterns

```json
"ownerEnamePath": "ename"                            // direct field on the entity
"ownerEnamePath": "users(createdBy.ename)"           // nested via a relation
"ownerEnamePath": "users(participants[].ename)"      // array relation
"ownerEnamePath": "users(createdBy.ename) || ename"  // fallback
```

The adapter uses this to write to the correct owner's eVault. If it resolves to nothing, `handleChange` returns without syncing.

### Junction tables

Junction (many-to-many) tables that are conceptually part of a parent entity:

```json
"ownedJunctionTables": ["user_followers", "user_following"]
```

When rows in a listed junction table change, the adapter re-syncs the parent entity.

### Complete examples

User:

```json
{
  "tableName": "users",
  "schemaId":  "550e8400-e29b-41d4-a716-446655440000",
  "ownerEnamePath": "ename",
  "ownedJunctionTables": ["user_followers", "user_following"],
  "localToUniversalMap": {
    "handle":       "username",
    "name":         "displayName",
    "description":  "bio",
    "avatarUrl":    "avatarUrl",
    "ename":        "ename",
    "followers":    "followers",
    "following":    "following"
  }
}
```

Group with relations:

```json
{
  "tableName": "groups",
  "schemaId":  "550e8400-e29b-41d4-a716-446655440003",
  "ownerEnamePath": "users(participants[].ename)",
  "localToUniversalMap": {
    "name":         "name",
    "description":  "description",
    "owner":        "owner",
    "admins":       "users(admins),admins",
    "participants": "users(participants[].id),participantIds",
    "createdAt":    "__date(createdAt)",
    "updatedAt":    "__date(updatedAt)"
  }
}
```

## Web3 Adapter — the sync engine

Source: `docs/docs/Infrastructure/Web3-Adapter.md`.

### Components

- **Web3Adapter** — the main class. Config: `schemasPath`, `dbPath`, `registryUrl`, `platform`. Exposes `handleChange` and `fromGlobal`.
- **EVaultClient** — resolves eNames via Registry `/resolve`, obtains a platform token via `POST /platforms/certification`, caches clients per eName, health-checks with `HEAD /whois`. Calls `storeMetaEnvelope` / `updateMetaEnvelopeById` on the eVault (these are the internal names the client uses — externally-exposed idiomatic names are `create`/`update`).
- **Mapper** — `toGlobal({ data, mapping, mappingStore })` and `fromGlobal(...)`.
- **MappingDatabase** — SQLite store for `(local_id, global_id)`. Methods: `storeMapping`, `getLocalId(globalId)`, `getGlobalId(localId)`. If you use the bundled TypeScript adapter, ID mapping is handled for you.

### Outbound flow (local write → eVault)

```
platform detects DB change
    ↓
adapter.handleChange({ data, tableName, participants })
    ↓
lookup mapping for tableName; if missing or readOnly → return
    ↓
mappingDb.getGlobalId(localId)?
    ├── yes → toGlobal(...) → EVaultClient.updateMetaEnvelopeById(globalId, ...)
    └── no  → toGlobal(...) → resolve ownerEname
              if no owner → return
              EVaultClient.storeMetaEnvelope({ w3id, data, schemaId })
              mappingDb.storeMapping({ localId, globalId })
              for each participant eName: storeReference(ownerEvault/globalId, otherEvault)
    ↓
eVault fires Awareness Protocol → other platforms' /api/webhook
```

The requesting platform is excluded from the fanout. Detail in [protocols.md § Awareness Protocol](protocols.md#awareness-protocol-webhooks).

### Change detection

The adapter does **not** poll. The platform is responsible for calling `handleChange(...)` after every write. Common patterns:

- **ORM event listeners** (afterInsert / afterUpdate / afterDelete).
- **DB triggers** on INSERT / UPDATE / DELETE.
- **Change data capture** (CDC) on the WAL.
- **Application-level hooks** (call adapter directly after the write).
- **Transactional outbox** — write to an outbox table in the same transaction as the entity write; a worker calls `handleChange`. Best consistency guarantee.

### Inbound flow (webhook → local write)

Handled by the webhook controller shown earlier — the adapter's `fromGlobal` does the schema conversion.

## Common integration bugs

Every one of these has bitten someone. Address them in code review:

1. **Missing `ownerEnamePath`** in a mapping → `handleChange` silently returns, entity never syncs.
2. **ID mapping not persisted** → the same entity arrives on the platform via webhook after outbound sync, and the controller creates a duplicate local row instead of recognizing the entity it just wrote.
3. **Array mapping without `[].id`** → tries to sync the raw objects instead of extracted IDs, mapper fails.
4. **Guessed ontology UUIDs** → mapping.json ships with a made-up schemaId; every webhook for that schema is silently dropped because no mapping matches.
5. **Confusing `File` ontology and `w3ds-file-v1`** → payload has the wrong field names. See [protocols.md § w3ds-file-v1 vs File ontology](protocols.md#w3ds-file-v1-vs-file-ontology--do-not-confuse).
6. **`__date` not applied on Firebase timestamps** → strings arrive instead of dates on the receiving side.
7. **Non-idempotent webhook controller** → duplicate deliveries create duplicate rows. Always upsert by global ID.
8. **Auth expects the user to exist before webhook** → for a fresh eVault, the User MetaEnvelope needs to have been synced first. Order: provision + create User in eVault → webhook creates local user → then login can succeed.
9. **Missing `X-ENAME` on adapter calls** → 400s on every eVault write.

## Known limitations

Prototype-level; on the roadmap:

- Ontology versioning — `schemaId` is a single W3ID today; a `schemaVersion` key is planned.
- Conflict resolution — last-write-wins today. No merge or CRDT.
- Idempotency keys — not yet standardized on the wire.
- Transactional outbox not built-in.
- Mapping expressiveness — richer `ownerEnamePath`, better array handling planned.

Design your platform's consistency layer accordingly.

## References in the docs

- Getting started (auth): `docs/docs/Post Platform Guide/getting-started.md`
- Webhook controller: `docs/docs/Post Platform Guide/webhook-controller.md`
- Mapping rules: `docs/docs/Post Platform Guide/mapping-rules.md`
- eCurrency example: `docs/docs/Post Platform Guide/ecurrency-accounts-and-ledger.md`
- Web3 Adapter architecture: `docs/docs/Infrastructure/Web3-Adapter.md`
- Awareness Protocol packet + timing: `docs/docs/W3DS Protocol/Awareness-Protocol.md`
