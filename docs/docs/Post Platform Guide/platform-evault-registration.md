---
sidebar_position: 8
---

# Registering a Platform eVault

A **platform eVault** is an eVault owned by the platform itself rather than by any end user. It gives the platform its own W3ID/eName so it can act as a first-class participant on the network — writing MetaEnvelopes, holding platform-scoped data, and being resolved like any other eVault.

The reference implementation lives in **Cerberus** (`platforms/cerberus/client`), in [`PlatformEVaultService`](https://github.com/) (`src/services/PlatformEVaultService.ts`). Any platform can follow the same flow.

## When it runs

Registration is a **one-time setup** that runs on platform boot. In Cerberus this is wired into startup (`src/index.ts`): after the database connects, it checks whether the platform eVault already exists and provisions one only if it doesn't.

```ts
const platformService = PlatformEVaultService.getInstance();
const exists = await platformService.checkPlatformEVaultExists();

if (!exists) {
    console.log("🔧 Creating platform eVault...");
    const result = await platformService.createPlatformEVault();
    console.log(`✅ Platform eVault created: ${result.w3id}`);
} else {
    console.log("✅ Platform eVault already exists");
}
```

The existence check is a local lookup — Cerberus stores the mapping under a fixed key (`localUserId: "cerberus-platform"`), so re-running boot never re-provisions.

## The registration flow

Provisioning a platform eVault is two calls against the infrastructure, followed by persisting the result locally.

### Step 1 — Get entropy from the Registry

Request a fresh entropy token from the Registry. This token authorizes the subsequent provision request.

```ts
const registryUrl = process.env.PUBLIC_REGISTRY_URL || "http://localhost:3000";
const {
    data: { token: registryEntropy },
} = await axios.get(new URL("/entropy", registryUrl).toString());
```

### Step 2 — Provision the eVault

`POST /provision` on the Provisioner, passing the entropy token, a fresh `namespace`, a verification id, and a public key. A successful response returns the platform's `w3id` (eName) and its `uri`.

```ts
const provisionerUrl = process.env.PUBLIC_PROVISIONER_URL || "http://localhost:3001";
const verificationId = process.env.DEMO_VERIFICATION_CODE || "<verification-id>";

const { data } = await axios.post(
    new URL("/provision", provisionerUrl).toString(),
    {
        registryEntropy,
        namespace: uuidv4(),
        verificationId,
        publicKey: "0x0000000000000000000000000000000000000000",
    },
);

if (!data || data.success !== true) {
    throw new Error("Failed to provision platform eVault");
}

const { w3id, uri } = data;
```

**Request fields**

| Field | Description |
| --- | --- |
| `registryEntropy` | The entropy token from Step 1. |
| `namespace` | A fresh UUID that scopes this eVault. |
| `verificationId` | Verification code authorizing provisioning (in local/demo setups this comes from `DEMO_VERIFICATION_CODE`). |
| `publicKey` | The platform's public key. |

**Response fields**

| Field | Description |
| --- | --- |
| `success` | Must be `true`; anything else is treated as a failure. |
| `w3id` | The platform's assigned W3ID / eName. |
| `uri` | The endpoint URI of the newly provisioned eVault. |

### Step 3 — Persist the mapping

Save `w3id` and `uri` locally so the platform can resolve and reuse its eVault on every subsequent boot, and so the existence check in Step 0 short-circuits. Cerberus stores this under the fixed key `cerberus-platform`.

Once persisted, helpers such as `getPlatformEName()` and `getPlatformEVaultUri()` read straight from this mapping.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PUBLIC_REGISTRY_URL` | `http://localhost:3000` | Registry base URL — source of the entropy token and eVault resolution. |
| `PUBLIC_PROVISIONER_URL` | `http://localhost:3001` | Provisioner base URL — the `/provision` endpoint. |
| `DEMO_VERIFICATION_CODE` | — | Verification id sent with the provision request in local/demo setups. |

See [Local Dev Quick Start](/docs/Post%20Platform%20Guide/local-dev-quick-start) for bringing up the Registry and Provisioner locally.

## Resolving the platform eVault later

The stored `w3id` resolves to a live GraphQL endpoint through the Registry's `resolve` endpoint:

```ts
const response = await axios.get(
    new URL(`resolve?w3id=${w3id}`, registryUrl).toString(),
);
const endpoint = new URL("/graphql", response.data.uri).toString();
```

Requests to the platform eVault are then made against that endpoint with the platform's eName supplied via the `X-ENAME` header.

## Summary

1. On boot, check whether the platform eVault already exists — provision only if it doesn't.
2. Fetch an entropy token from the Registry.
3. `POST /provision` on the Provisioner with the entropy token, a fresh namespace, a verification id, and the platform public key.
4. Persist the returned `w3id` and `uri` so the platform can resolve and reuse its eVault on every subsequent boot.
