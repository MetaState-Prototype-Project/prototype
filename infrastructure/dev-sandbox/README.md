# W3DS Dev Sandbox

Minimal browser app to test W3DS wallet flows (provision, sync key, auth, sign) without the real eID wallet. Uses the [wallet-sdk](../../packages/wallet-sdk) with a Web Crypto adapter.

## Run

From the repo root:

```bash
pnpm install
pnpm --filter dev-sandbox dev
```

Or from this directory:

```bash
pnpm dev
```

The app opens at `http://localhost:5174`.

## Config

Env vars use the **PUBLIC_** prefix (SvelteKit) and are loaded from the **repo root** `.env`. Set them there or rely on defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_REGISTRY_URL` | `http://localhost:3001` | Registry base URL (entropy) |
| `PUBLIC_PROVISIONER_URL` | `http://localhost:4321` | Provisioner base URL (POST /provision) |

## Walkthrough: provision → sync key → auth

1. **Provision**  
   Click “Provision new eVault”. The app uses the Web Crypto adapter to generate a key, fetches entropy from the Registry, and calls the Provisioner. You get a **W3ID** and **eVault URI**; copy them if needed.

2. **Sync public key** (optional)  
   To register the adapter’s public key with the eVault, enter a Bearer token (if your eVault’s PATCH /public-key requires one) and click “Sync public key”. For local dev you may need to obtain a token from your eVault/backend or skip this step.

3. **Authenticate to platform**  
   Paste a `w3ds://auth?redirect=...&session=...&platform=...` URI (or a `w3ds://sign?...` URI for sign flows). You can also **upload or paste an image** of a QR code: use “Upload QR image” or paste from the clipboard (Ctrl+V). The decoded W3DS URI is filled into the text area; click “Perform” to run the auth/sign flow.

4. **Sign payload**  
   Type any string and click “Sign” to get a signature from the selected identity’s key (e.g. for testing or custom flows).

## W3DS URI input: paste or QR image

The “Paste any w3ds URI” section accepts:

- **Text:** Paste a `w3ds://auth` or `w3ds://sign` URI (or an HTTP URL that includes `session` / `redirect_uri`).
- **QR image:** Click “Upload QR image” to choose a file, or **paste an image** (e.g. screenshot) with Ctrl+V anywhere on the page. The app decodes the QR and fills the URI into the text area so you can review and click “Perform”.

## Notes

- Keys are kept in memory only; they are lost on page reload. Provision again after refresh.
- The sandbox does not persist identities; the list is in-memory for the session.
