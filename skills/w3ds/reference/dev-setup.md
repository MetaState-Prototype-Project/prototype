# Local dev + debugging

One command spins up the full W3DS core stack. Most sync bugs come from a service that isn't running or a missing env var — always verify the stack is healthy before hunting deeper. Source: `docs/docs/Post Platform Guide/local-dev-quick-start.md`, `dev-sandbox.md`.

## Prerequisites

- **Docker** — for Postgres and Neo4j.
- **Node.js 18+** and **pnpm**.
- **`.env`** in the repo root (copy from `.env.example` if present).

## Environment

Minimum `.env` for the core stack:

```bash
# Postgres (used by registry)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
REGISTRY_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/registry

# Registry: ES256 key for signing entropy tokens (REQUIRED)
REGISTRY_ENTROPY_KEY_JWK='<paste generated JWK here>'

# Neo4j (used by evault-core)
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
NEO4J_URI=bolt://127.0.0.1:7687

# So sandbox and evault-core can talk to registry/provisioner
PUBLIC_REGISTRY_URL=http://localhost:4321
PUBLIC_PROVISIONER_URL=http://localhost:3001
PUBLIC_EVAULT_SERVER_URI=http://localhost:4000
REGISTRY_SHARED_SECRET=dev-secret-change-me
```

### Generating `REGISTRY_ENTROPY_KEY_JWK`

The Registry signs entropy tokens with an ES256 key. Generate one:

```bash
pnpm generate-entropy-jwk
```

Paste the output into `.env` as `REGISTRY_ENTROPY_KEY_JWK='<paste>'`. Keep this key private. Reuse the same value across local dev if you need tokens to verify elsewhere.

## One-command bootstrap

```bash
pnpm install
pnpm dev:core
```

That starts:

1. **Postgres** (5432) and **Neo4j** (7474 HTTP, 7687 Bolt) via `docker-compose.databases.yml`.
2. Waits for Postgres to be ready.
3. Runs registry + eVault-core migrations.
4. Starts **registry** (4321), **eVault-core** (3001 provisioning + 4000 GraphQL), and **dev-sandbox** (8080) in parallel.

Stop with Ctrl+C. Stop only databases with `pnpm docker:core:down`.

### Or step-by-step

```bash
pnpm dev:core:docker     # start Postgres + Neo4j
pnpm dev:core:wait       # wait for 5432 and 7687
pnpm dev:core:migrate    # migrations
pnpm dev:core:apps       # start registry, eVault-core, dev-sandbox
```

## Ports

| Service | Port | Notes |
|---|---|---|
| Postgres | 5432 | Registry DB |
| Neo4j HTTP | 7474 | Browser UI |
| Neo4j Bolt | 7687 | eVault-core connection |
| Registry | 4321 | `/resolve`, `/entropy`, `/list`, `/.well-known/jwks.json` |
| eVault-core (provisioning) | 3001 | `POST /provision` (also acts as the Provisioner in local dev) |
| eVault-core (GraphQL) | 4000 | `/graphql`, `/whois`, `/logs`, `/files/:id`, `PATCH /public-key` |
| **Dev Sandbox** | **8080** | Browser wallet substitute |

Open **http://localhost:8080** for the Dev Sandbox.

## Dev Sandbox — the wallet substitute

Source: `docs/docs/Post Platform Guide/dev-sandbox.md`.

The Dev Sandbox is a minimal browser app that uses `wallet-sdk` with a Web Crypto adapter. It lets you:

- **Provision** — generate a key pair, get entropy, call the Provisioner. On success, syncs the public key to the eVault and creates a random UserProfile automatically. Result: usable `w3id` + `evaultUri`.
- **Identities** — stored in browser localStorage. Select one to use for auth / sign.
- **Paste any `w3ds://auth` or `w3ds://sign` URI** → click **Perform** to sign the session and POST to the callback URL.
- **Sign payload** — arbitrary string signing for custom flows.
- **Log panel** — split-screen debug log.

### Running standalone

If Registry and eVault-core are already up (via Docker or another terminal):

```bash
pnpm --filter dev-sandbox dev
```

Reads `PUBLIC_REGISTRY_URL` and `PUBLIC_PROVISIONER_URL` from the repo root `.env`. Point these at your target stack (local, staging).

### Testing a platform's auth flow with the sandbox

1. Start your platform. Ensure it exposes `GET /api/auth/offer` and `POST /api/auth`.
2. Start the sandbox (`pnpm dev:core` or `pnpm --filter dev-sandbox dev`), open http://localhost:8080.
3. Click "Provision new eVault". Wait for "Public key synced" and "UserProfile created" in the log.
4. Get an auth offer from your platform (open the login page or curl the offer endpoint) → copy the `w3ds://auth?...` URL.
5. Paste into the sandbox's "Paste any w3ds URI" field → click **Perform**. The sandbox signs the session and POSTs to your callback.
6. Verify your platform received the POST, verified the signature, and issued a session.

Same pattern for `w3ds://sign` — paste the URI, click Perform, watch your callback receive `{ sessionId, signature, w3id, message }`.

## Debugging playbook

### Webhook not firing on other platforms

**Symptom**: platform A writes to its eVault, platform B never gets a webhook.

Check in order:

1. Is your platform registered? Query `GET http://localhost:4321/list` and confirm your platform's URL is in the response.
2. If the write is a **create** (not update), remember there is a **3-second delay** before fanout. Wait, then re-check.
3. Is your `/api/webhook` endpoint publicly reachable from eVault-core? (In local dev, `localhost` works. In containers, use the service name or host.docker.internal.)
4. Does the packet's `schemaId` match a mapping in your Web3 Adapter? If not, your controller correctly drops it — that's expected.

### Duplicate entities on sync

**Symptom**: writing to platform A causes duplicates to appear on platform A after the webhook echo (or on other platforms after their echoes).

Cause: ID mapping not persisted. Check that `mappingDb.storeMapping({ localId, globalId })` runs after every successful create in both directions:

- Outbound: after `EVaultClient.storeMetaEnvelope` returns the new `globalId`.
- Inbound: after your webhook controller creates the local entity.

Verify with a query to your `MappingDatabase`: for a known global ID, `getLocalId(globalId)` must return the local row's ID.

### Signature verification fails

Common causes, in order of frequency:

1. **Wrong `payload`** — the `session` field must be the exact string that was signed, byte-for-byte. If your client is re-serializing JSON, whitespace differences will break verification.
2. **Signature encoding mismatch** — hardware-key signatures use multibase base58btc (starts with `z`). Software-key signatures use plain base64. The validator auto-detects, but if you extract signature bytes yourself, you can slip up.
3. **Key never synced to eVault** — call `GET {evaultUri}/whois -H "X-ENAME: @user"`. Empty `keyBindingCertificates` means the wallet's `PATCH /public-key` never ran. Re-run onboarding or use `wallet-sdk`'s `syncPublicKeyToEvault`.
4. **Certificate expired** — key-binding certs are valid 1 hour. If the eVault has been idle, the cert may have expired. eVault regenerates on demand — retry.
5. **JWKS endpoint unreachable** — `GET http://localhost:4321/.well-known/jwks.json` should return a JWK set. If it 404s, the Registry is misconfigured (usually a missing `REGISTRY_ENTROPY_KEY_JWK` env var).

### `/whois` returns empty certificates

Wallet has never called `PATCH /public-key` for this eName. Fix by:

- Re-running the onboarding provision (with `publicKey` in the body), or
- Calling `syncPublicKeyToEvault` from wallet-sdk explicitly.

If the wallet's `authToken` for `PATCH /public-key` is misconfigured, the endpoint returns 401 — check `PUBLIC_EID_WALLET_TOKEN` in the sandbox / wallet env.

### Neo4j "encryption setting" or connection refused

The stack ships Neo4j 4.4 (unencrypted Bolt by default). If a previous 5.x run left volumes, purge and recreate:

```bash
docker compose -f docker-compose.databases.yml down
docker volume rm metastate_neo4j_data 2>/dev/null || true
docker compose -f docker-compose.databases.yml up -d
pnpm dev:core
```

Otherwise ensure `.env` has:

```bash
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
```

### Provision returns 400

Check request body order:

1. `registryEntropy` must be a fresh JWT from `GET /entropy` (valid 1 hour).
2. `namespace` should be a UUID.
3. `verificationId` — in local dev, use the demo verification code your Provisioner is configured to accept (see the Provisioner's env).
4. `publicKey` — optional; if provided, must be multibase-encoded ECDSA P-256 SPKI DER.

### Auth POST rejects "User not found"

Order of operations matters. A user must exist in your platform's DB before they can log in — the User is created by your webhook controller when the User MetaEnvelope (ontology `550e8400-...440000`) arrives.

Correct sequence for a new user:

1. User provisions their eVault (via wallet or sandbox).
2. Wallet / sandbox writes a User MetaEnvelope to that eVault.
3. eVault fires webhooks including yours.
4. Your webhook controller creates the local User row.
5. Now the user can log in.

If step 3 or 4 didn't happen, `/api/auth` correctly returns 404.

### `pnpm dev:core` starts but sandbox can't provision

The sandbox reads `PUBLIC_REGISTRY_URL` and `PUBLIC_PROVISIONER_URL` from `.env` at build time. If you edited `.env` after starting, restart the sandbox process (`pnpm --filter dev-sandbox dev`).

## Databases-only mode

If you run app services yourself and only need Postgres + Neo4j:

```bash
pnpm docker:core
# or
docker compose -f docker-compose.databases.yml up -d
```

Stop:

```bash
pnpm docker:core:down
```

## References in the docs

- Local dev quick start: `docs/docs/Post Platform Guide/local-dev-quick-start.md`
- Dev Sandbox: `docs/docs/Post Platform Guide/dev-sandbox.md`
- Full Docker setup + platforms: repo root `README.md`
