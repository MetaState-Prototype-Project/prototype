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

### Step 3 — Write the PlatformProfile into the eVault

With the eVault provisioned, write a **PlatformProfile** MetaEnvelope into it. This is the record other participants read to discover your platform — the **Marketplace**, for example, pulls every PlatformProfile from **Awareness-as-a-Service** and renders one card per platform. Its `url`, `logoUrl`, and `category` fields are what drive that card, so fill them in.

The profile is stored under the **User-profile ontology** (`550e8400-e29b-41d4-a716-446655440000`) with a public ACL (`["*"]`). It is distinguished from an ordinary user profile by the presence of a `platformName` field — that is exactly the marker consumers filter on.

```ts
const now = new Date().toISOString();
const platformProfile = {
    platformName: "cerberus",              // stable slug; the discovery marker
    displayName: "Cerberus Platform",
    description: "Secure messaging and group management platform",
    version: "1.0.0",
    ename: w3id,
    isActive: true,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    url: "https://cerberus.w3ds.metastate.foundation",  // public web app URL
    logoUrl: "https://cerberus.w3ds.metastate.foundation/logo.png", // absolute logo URL
    category: "Social",                    // Identity | Social | Governance | Wellness | Finance | Storage | Productivity
};

// storeMetaEnvelope only needs the X-ENAME header (no Bearer token).
await client.request(STORE_META_ENVELOPE, {
    input: {
        ontology: "550e8400-e29b-41d4-a716-446655440000",
        payload: platformProfile,
        acl: ["*"],
    },
});
```

**Profile fields**

| Field | Type | Purpose |
| --- | --- | --- |
| `platformName` | string | Stable machine slug and the marker consumers filter on to tell a platform profile apart from a user profile. |
| `displayName` | string | Human-readable name shown to users. |
| `description` | string | Short blurb describing the platform. |
| `version` | string | Platform profile version. |
| `ename` | string | The platform's own eName (`w3id` from Step 2). |
| `isActive` | boolean | Whether the platform is live; consumers hide `false`. |
| `isArchived` | boolean | Soft-delete flag; consumers hide `true`. |
| `createdAt` / `updatedAt` | string | ISO-8601 timestamps. |
| `url` | string | **Public web app URL** — where "Open App" links. Required for the platform to be launchable from the Marketplace. |
| `logoUrl` | string | **Absolute URL** to the platform logo. Leave empty (`""`) to fall back to a placeholder icon. |
| `category` | string | One of `Identity`, `Social`, `Governance`, `Wellness`, `Finance`, `Storage`, `Productivity` (or a custom value — it becomes a filter chip). |

:::note
`storeMetaEnvelope` creates a **new** MetaEnvelope each call. To later change a field (e.g. add a `url` that predates this schema), update the existing profile by id with `updateMetaEnvelope(id, …)` — which requires a Bearer token — rather than calling `storeMetaEnvelope` again, otherwise you create a duplicate profile.
:::

### Step 4 — Persist the mapping

Save `w3id` and `uri` locally so the platform can resolve and reuse its eVault on every subsequent boot, and so the existence check in Step 0 short-circuits. Cerberus stores this under the fixed key `cerberus-platform`. Mirror the same `url`/`logoUrl`/`category` into the locally cached profile data so a later `updatePlatformProfile()` doesn't drop them.

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
4. Write a **PlatformProfile** MetaEnvelope (User-profile ontology, `acl: ["*"]`) into the eVault, including `url`, `logoUrl`, and `category` so consumers like the Marketplace can discover and render the platform.
5. Persist the returned `w3id` and `uri` (and mirror `url`/`logoUrl`/`category`) so the platform can resolve and reuse its eVault on every subsequent boot.
