---
sidebar_position: 4
---

# Using the Dev Sandbox

The **W3DS Dev Sandbox** is a minimal browser app that lets you test [provisioning](/docs/Infrastructure/eVault), [authentication](/docs/W3DS%20Protocol/Authentication), and [signing](/docs/W3DS%20Protocol/Signing) flows without the real eID wallet. It uses the wallet-sdk (`packages/wallet-sdk` in the repo) with a Web Crypto adapter and is intended for platform developers who need to drive `w3ds://auth` and `w3ds://sign` from a test identity.

## Running the Dev Sandbox

### Option 1: Quick start (recommended)

From the repo root, start Postgres, Neo4j, registry, evault-core, and the sandbox in one go:

```bash
pnpm install
pnpm dev:core
```

The sandbox is available at **http://localhost:8080**. See **QUICKSTART.md** in the repo root for prerequisites and environment variables.

### Option 2: Run the sandbox only

If registry and evault-core are already running (e.g. via Docker or another terminal):

```bash
pnpm --filter dev-sandbox dev
```

The app opens at **http://localhost:8080** (or the next available port if 8080 is in use).

### Port and environment

- **Default port:** 8080.
- **Environment:** The sandbox reads `PUBLIC_*` variables from the **repo root** `.env`. Important ones:
  - `PUBLIC_REGISTRY_URL` — Registry base URL (default `http://localhost:4321`).
  - `PUBLIC_PROVISIONER_URL` — Provisioner base URL (default `http://localhost:3001`).

Point these at your local or staging registry and provisioner so the sandbox can provision identities and sync keys.

## What the sandbox does

1. **Provision** — Creates a new eVault identity: generates a key pair, gets entropy from the registry, calls the provisioner. You get a **W3ID** and **eVault URI**. The sandbox automatically syncs the public key to the eVault and creates a random UserProfile (so the identity is ready for auth and whois).
2. **Identities** — Provisioned identities are stored in the browser (localStorage). You can select one and use it for auth and signing.
3. **w3ds://auth and w3ds://sign** — Paste a `w3ds://auth` or `w3ds://sign` URI (or the equivalent HTTP URL with `session` / `redirect_uri`). Click **Perform** to sign the session payload and POST the result to your platform’s callback URL.
4. **Sign payload** — Enter any string and click **Sign** to get a signature from the selected identity (useful for manual tests or custom flows).
5. **Log panel** — A split-screen log shows provision, sync, profile creation, and each auth/sign action for debugging.

No “Sync public key” step is required; the sandbox syncs the key and creates a UserProfile right after provision.

## Testing your platform’s auth flow

1. **Start your platform** (e.g. your API and frontend) and ensure it exposes:
   - An endpoint that returns a `w3ds://auth` offer (e.g. `GET /api/auth/offer`).
   - A callback endpoint that accepts the signed auth result (e.g. `POST /api/auth`).
2. **Start the dev sandbox** (e.g. `pnpm dev:core` or `pnpm --filter dev-sandbox dev`) and open http://localhost:8080.
3. **Provision** an identity in the sandbox (click “Provision new eVault”). Wait for “Public key synced” and “UserProfile created” in the log.
4. **Get an auth offer** from your platform (e.g. open your login page and copy the `w3ds://auth?...` URL, or call your offer API).
5. **Paste the URI** into the sandbox “Paste any w3ds URI” field and click **Perform**. The sandbox signs the session and POSTs to your callback URL.
6. **Verify** that your platform receives the POST, verifies the signature (e.g. with `signature-validator`), and issues a session or JWT.

Use the **Last action debug** section and the **Log** panel in the sandbox to inspect request/response and troubleshoot.

## Testing signing (w3ds://sign)

Same idea as auth: get a `w3ds://sign` URI from your platform (with `session`, `redirect_uri`, etc.), paste it into the sandbox, and click **Perform**. The sandbox signs the session and POSTs to your `redirect_uri`. Your platform should verify the signature and complete the flow.

## References

- [Getting started with platform development](/docs/Post%20Platform%20Guide/getting-started) — Auth implementation and endpoints
- [Authentication](/docs/W3DS%20Protocol/Authentication) — w3ds://auth protocol
- [Signing](/docs/W3DS%20Protocol/Signing) — Signature creation and verification
- [eVault](/docs/Infrastructure/eVault) — Provisioning and key binding
- [Registry](/docs/Infrastructure/Registry) — W3ID resolution
