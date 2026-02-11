---
sidebar_position: 6
---

# wallet-sdk

The **wallet-sdk** is a small TypeScript package that implements the high-level flows for eVault provisioning, platform authentication (signing), and public-key sync. It is **crypto-agnostic**: you supply a **CryptoAdapter** (BYOC – bring your own crypto), and the SDK handles the HTTP and protocol steps.

The [eID Wallet](/docs/Infrastructure/eID-Wallet) uses wallet-sdk with an adapter that delegates to its KeyService, so hardware/software key manager behavior is unchanged.

## Overview

- **Package**: `wallet-sdk` (workspace package under `packages/wallet-sdk/`)
- **Exports**: `CryptoAdapter` type, `provision`, `authenticate`, `syncPublicKeyToEvault`, and their option/result types
- **Dependencies**: `jose` (for JWT verification when checking existing keys during sync). Uses the global `fetch` for HTTP

## CryptoAdapter (BYOC)

Implement this interface to plug in your key storage (e.g. KeyService + hardware/software managers):

```typescript
interface CryptoAdapter {
  getPublicKey(keyId: string, context: string): Promise<string | undefined>;
  signPayload(keyId: string, context: string, payload: string): Promise<string>;
  ensureKey(keyId: string, context: string): Promise<{ created: boolean }>;
}
```

- **getPublicKey**: Return the public key for the given key id and context, or `undefined` if the key does not exist.
- **signPayload**: Sign the payload with the same key as used for `getPublicKey`. Return the signature string (encoding is up to the adapter, e.g. base64 or multibase).
- **ensureKey**: Ensure a key exists for the given key id and context; create it if needed. Return `{ created: true }` if a new key was created, `{ created: false }` otherwise.

Contexts used by the eID Wallet include `"onboarding"`, `"pre-verification"`, and `"signing"`. The SDK does not interpret contexts; it only passes them through to the adapter.

## API

### provision(adapter, options)

Provisions an eVault: fetches entropy from the Registry, gets the public key from the adapter, and POSTs to the Provisioner.

**Flow**:

1. `GET {registryUrl}/entropy` → obtain entropy token
2. `adapter.getPublicKey(keyId, context)` → public key (must exist; ensure key before calling if needed)
3. `POST {provisionerUrl}/provision` with `{ registryEntropy, namespace, verificationId, publicKey }`

**Options**: `registryUrl`, `provisionerUrl`, `namespace`, `verificationId`, and optionally `keyId` (default `"default"`), `context` (default derived from `isPreVerification`), `isPreVerification`.

**Returns**: `{ success, w3id, uri }`. Throws on HTTP or validation errors.

**Example** (eID Wallet pre-verification):

```typescript
const result = await provision(globalState.walletSdkAdapter, {
  registryUrl: PUBLIC_REGISTRY_URL,
  provisionerUrl: PUBLIC_PROVISIONER_URL,
  namespace: uuidv4(),
  verificationId,
  keyId: "default",
  context: "pre-verification",
  isPreVerification: true,
});
// result.uri, result.w3id
```

### authenticate(adapter, options)

Ensures the key exists and signs the session payload. The **caller** is responsible for sending the signature to the platform (e.g. POST to redirect URL or open deeplink).

**Flow**:

1. `adapter.ensureKey(keyId, context)`
2. `adapter.signPayload(keyId, context, sessionId)`
3. Return `{ signature }`

**Options**: `sessionId`, `context`, and optionally `keyId` (default `"default"`).

**Returns**: `{ signature }`.

**Example** (eID Wallet auth):

```typescript
const { signature } = await authenticate(globalState.walletSdkAdapter, {
  sessionId: sessionPayload,
  keyId: "default",
  context: isFake ? "pre-verification" : "onboarding",
});
// Then POST to redirect URL: { ename, session, signature, appVersion }
```

### syncPublicKeyToEvault(adapter, options)

Syncs the adapter’s public key to the eVault: calls `/whois`, optionally skips PATCH if the current key is already present in key-binding certificates (using Registry JWKS), then `PATCH /public-key` if needed.

**Flow**:

1. `GET {evaultUri}/whois` with header `X-ENAME: {eName}`
2. If `registryUrl` is provided and whois returns key-binding certificates, verify with Registry’s `/.well-known/jwks.json` and skip PATCH if the current public key is already in a valid cert for this eName
3. `adapter.getPublicKey(keyId, context)`
4. `PATCH {evaultUri}/public-key` with `{ publicKey }`, headers `X-ENAME` and optional `Authorization: Bearer {authToken}`

The SDK does not read or write `localStorage`; the caller can set a hint (e.g. `publicKeySaved_${eName}`) after a successful sync.

**Options**: `evaultUri`, `eName`, `context`, and optionally `keyId` (default `"default"`), `authToken`, `registryUrl` (for skip-if-present verification).

**Example** (eID Wallet):

```typescript
await syncPublicKeyToEvault(globalState.walletSdkAdapter, {
  evaultUri: vault.uri,
  eName,
  keyId: "default",
  context: isFake ? "pre-verification" : "onboarding",
  authToken: PUBLIC_EID_WALLET_TOKEN || null,
  registryUrl: PUBLIC_REGISTRY_URL,
});
```

## Use in the eID Wallet

The eID Wallet:

1. Implements a **CryptoAdapter** by wrapping KeyService in `createKeyServiceCryptoAdapter(keyService)` (see `src/lib/wallet-sdk-adapter.ts`).
2. Exposes this adapter on GlobalState as `walletSdkAdapter` and passes it into VaultController.
3. Uses **provision** in the onboarding (pre-verification) and verify (real user) flows instead of inline entropy + provision calls.
4. Uses **authenticate** in the scan-qr auth and signing flows, then performs the POST or deeplink open in the UI.
5. Uses **syncPublicKeyToEvault** inside `VaultController.syncPublicKey(eName)` instead of inline whois + PATCH logic.

See [eID Wallet](/docs/Infrastructure/eID-Wallet) for architecture and key manager details.

## References

- [eID Wallet](/docs/Infrastructure/eID-Wallet) – Consumer of wallet-sdk; KeyService and CryptoAdapter
- [Registry](/docs/Infrastructure/Registry) – Entropy and key-binding certificates
- [eVault](/docs/Infrastructure/eVault) – Whois and public-key storage
- [Links](/docs/W3DS%20Basics/Links) – Production URLs (Provisioner, Registry)
