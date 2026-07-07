# eID Wallet + wallet-sdk + key delegation

Everything about identity provisioning, signature creation, and key management across devices. Source: `docs/docs/Infrastructure/eID-Wallet.md`, `wallet-sdk.md`, `eVault-Key-Delegation.md`.

## eID Wallet — what it is

A **Tauri-based mobile app** (Rust + SvelteKit + TypeScript) that:

- Generates and stores ECDSA P-256 key pairs.
- Uses hardware-backed key storage: **Secure Enclave** (iOS via LocalAuthentication), **HSM** (Android via KeyStore). Falls back to Web Crypto API for software keys.
- Provides the UI for onboarding, provisioning an eVault, and signing session IDs during platform auth and `w3ds://sign` flows.
- Uses `wallet-sdk` internally for the high-level flows.

### Key manager selection

The wallet picks its key manager per context:

| Context | Manager |
|---|---|
| Pre-verification / test users | **Software** (Web Crypto API). |
| Real KYC-verified users | **Hardware only.** No software fallback — onboarding is blocked if hardware unavailable. |
| Non-onboarding operations | Explicit choice via configuration. |

Contexts used by wallet code include `"onboarding"`, `"pre-verification"`, `"signing"`.

### Signature output formats

Determined by manager:

- **Software** — base64-encoded raw 64-byte signature (r || s).
- **Hardware** — multibase base58btc (`z...`), often DER internally.

Verifier auto-detects. Detail in [protocols.md § Signature formats](protocols.md#signature-formats).

## Provisioning — onboarding a new eVault

Endpoint: `POST /provision` on the Provisioner service. Local dev: port **3001** (co-hosted by eVault-core). Prod: `https://provisioner.w3ds.metastate.foundation`.

### Request

```http
POST /provision
Content-Type: application/json

{
  "registryEntropy": "<JWT from GET /entropy>",
  "namespace":       "<UUID>",
  "verificationId":  "<KYC verification code or demo code>",
  "publicKey":       "z..."   // OPTIONAL — multibase, ECDSA P-256, SPKI DER inside
}
```

### Response

```json
{ "w3id": "@e4d909c2-...", "uri": "https://evault.example.com/users/..." }
```

### `publicKey` — when to include

- **User eVaults** — include it. The Provisioner passes it to eVault-core which stores the key and requests a Registry-issued key-binding certificate. Without a key, the eVault can't verify signatures on behalf of that user.
- **Keyless eVaults** (platforms, groups) — omit it. Some services don't need signature verification.

### Full flow

```text
1. keyService.generate("default", "onboarding")       → hardware key pair
2. GET  {registryUrl}/entropy                          → { token: JWT }
3. POST {provisionerUrl}/provision                     → { w3id, uri }
    body: { registryEntropy, namespace, verificationId, publicKey }
    (eVault-core stores publicKey and requests a key-binding cert from Registry)
4. Local wallet stores { w3id, uri, publicKey, privateKey } for later use
```

## wallet-sdk

Location: `packages/wallet-sdk/`. Purpose: implement the high-level flows (provision, auth, key sync) while remaining crypto-agnostic via the `CryptoAdapter` interface.

Dependencies: `jose` (JWT verification during sync). Uses global `fetch`.

### `CryptoAdapter` — BYOC

```typescript
interface CryptoAdapter {
  getPublicKey(keyId: string, context: string): Promise<string | undefined>;
  signPayload(keyId: string, context: string, payload: string): Promise<string>;
  ensureKey(keyId: string, context: string): Promise<{ created: boolean }>;
}
```

- `getPublicKey` — multibase-encoded key or `undefined` if none.
- `signPayload` — signs and returns whatever encoding the adapter chooses (base64 for software, multibase for hardware).
- `ensureKey` — generates if missing; returns whether a new key was created.

The eID Wallet wraps its KeyService in this interface via `createKeyServiceCryptoAdapter(keyService)` and exposes it on `GlobalState.walletSdkAdapter`.

Contexts are opaque to the SDK — it just passes them through.

### `provision(adapter, options)`

Full end-to-end eVault provisioning.

Steps:

1. `GET {registryUrl}/entropy` → entropy token.
2. `adapter.getPublicKey(keyId, context)` → public key (must exist; call `ensureKey` first if needed).
3. `POST {provisionerUrl}/provision` with `{ registryEntropy, namespace, verificationId, publicKey }`.

Options: `registryUrl`, `provisionerUrl`, `namespace`, `verificationId`, and optionally `keyId` (default `"default"`), `context` (default derived from `isPreVerification`), `isPreVerification`.

Returns: `{ success, w3id, uri }`. Throws on HTTP or validation errors.

```typescript
const result = await provision(globalState.walletSdkAdapter, {
  registryUrl:    PUBLIC_REGISTRY_URL,
  provisionerUrl: PUBLIC_PROVISIONER_URL,
  namespace:      uuidv4(),
  verificationId,
  keyId:          "default",
  context:        "pre-verification",
  isPreVerification: true,
});
// result.w3id, result.uri
```

### `authenticate(adapter, options)`

Ensures the key exists and signs a session ID. The **caller** is responsible for POSTing the signature to the platform's `redirect` URL — the SDK does not do this for you.

Steps:

1. `adapter.ensureKey(keyId, context)`.
2. `adapter.signPayload(keyId, context, sessionId)`.
3. Return `{ signature }`.

Options: `sessionId`, `context`, and optionally `keyId` (default `"default"`).

```typescript
const { signature } = await authenticate(globalState.walletSdkAdapter, {
  sessionId: sessionPayload,
  keyId:     "default",
  context:   isFake ? "pre-verification" : "onboarding",
});

// Then POST to the redirect URL from the w3ds://auth URI:
//   { ename, session, signature, appVersion }
```

### `syncPublicKeyToEvault(adapter, options)`

Syncs the adapter's public key to the eVault. Optionally skips PATCH if the current key is already present in a valid key-binding certificate (avoids unnecessary Registry round-trips).

Steps:

1. `GET {evaultUri}/whois` with `X-ENAME: {eName}` → `{ keyBindingCertificates: [...] }`.
2. If `registryUrl` is provided, verify each cert JWT with the Registry JWKS. If the current public key is already in a valid cert for this eName, skip the PATCH.
3. `adapter.getPublicKey(keyId, context)`.
4. `PATCH {evaultUri}/public-key` with `{ publicKey }` and headers `X-ENAME` (required), `Authorization: Bearer {authToken}` (optional).

Options: `evaultUri`, `eName`, `context`, optionally `keyId` (default `"default"`), `authToken`, `registryUrl` (enables skip-if-present verification).

The SDK does not read or write `localStorage`. Callers can persist a hint like `publicKeySaved_${eName}` themselves.

```typescript
await syncPublicKeyToEvault(globalState.walletSdkAdapter, {
  evaultUri:    vault.uri,
  eName,
  keyId:        "default",
  context:      isFake ? "pre-verification" : "onboarding",
  authToken:    PUBLIC_EID_WALLET_TOKEN || null,
  registryUrl:  PUBLIC_REGISTRY_URL,
});
```

## Key delegation across devices

W3IDs are loosely bound to keys — the W3ID never changes when keys do. This is what enables multi-device support, key rotation, and friend-based recovery.

### Multi-device

- Each device generates its own ECDSA P-256 key pair.
- Each device syncs its own public key to the same eVault (`PATCH /public-key`).
- eVault stores all keys and requests a key-binding certificate per key.
- Verifier iterates certificates until one matches — any device's signature verifies.

### Key rotation

Roadmap feature — not fully implemented today.

Conceptual flow:

1. Generate a new key on the new device.
2. `PATCH /public-key` to add it.
3. eVault requests a new key-binding certificate from the Registry.
4. Optionally revoke old keys (revocation UX is not built yet).

The W3ID does not change during rotation.

### Friend-based recovery

A trust list (2–3 friends or notaries) can vouch for identity and approve key changes. The user defines the list while they still hold their keys. Not yet implemented — described in `docs/docs/W3DS Basics/W3ID.md`.

## eVault endpoints used by the wallet

### `PATCH /public-key`

```http
PATCH /public-key
X-ENAME: @user.w3id
Authorization: Bearer <token>
Content-Type: application/json

{ "publicKey": "z3059301306072a8648ce3d020106082a8648ce3d03010703420004..." }
```

- 200 — key stored, key-binding certificate requested from Registry.
- 400 — missing X-ENAME or invalid body.
- 401 — invalid auth token.

### `GET /whois`

Returns `{ w3id, evaultId, keyBindingCertificates: [<JWT>, ...] }`. Detail in [evault.md § GET /whois](evault.md#get-whois).

## Desktop dev keys (no mobile wallet)

For local development, you can generate ECDSA P-256 keys with the Web Crypto API, provision an eVault, and sign requests without touching a mobile device. The Dev Sandbox (`http://localhost:8080` after `pnpm dev:core`) implements this exact flow — see [dev-setup.md](dev-setup.md).

### Manual outline

```typescript
// 1. Generate keys
const keyPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const spki = await crypto.subtle.exportKey("spki", keyPair.publicKey);
const publicKey = "m" + btoa(String.fromCharCode(...new Uint8Array(spki))); // multibase base64

// 2. Provision
const { token: entropyToken } = await fetch(`${registryUrl}/entropy`).then(r => r.json());
const { w3id, uri } = await fetch(`${provisionerUrl}/provision`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    registryEntropy: entropyToken,
    namespace:       crypto.randomUUID(),
    verificationId:  DEMO_VERIFICATION_ID,
    publicKey,
  }),
}).then(r => r.json());

// 3. Sign a session ID
const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
const sigBuf = await crypto.subtle.sign(
  { name: "ECDSA", hash: "SHA-256" },
  keyPair.privateKey,
  hash,
);
const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf))); // base64
```

### Key storage (desktop)

Store as JSON with `chmod 600`:

```json
{
  "ename":      "@e4d909c2-...",
  "evaultUri":  "https://evault.example.com/users/...",
  "publicKey":  "m...",
  "privateKey": "<base64 PKCS8>",
  "createdAt":  "2025-01-24T10:00:00Z"
}
```

Never commit. Never reuse across environments. Never use desktop keys in production.

## References in the docs

- eID Wallet architecture: `docs/docs/Infrastructure/eID-Wallet.md`
- wallet-sdk API: `docs/docs/Infrastructure/wallet-sdk.md`
- Key delegation + `PATCH /public-key`: `docs/docs/Infrastructure/eVault-Key-Delegation.md`
- Desktop signing detail: `docs/docs/W3DS Protocol/Signature-Formats.md`
- Dev Sandbox (in-browser wallet substitute): `docs/docs/Post Platform Guide/dev-sandbox.md`
