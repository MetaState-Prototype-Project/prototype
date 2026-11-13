---
sidebar_position: 8
title: Register a deployment
description: Create and sign a verifiable W3DS deployment record for a PPA-certified release.
---

# Register a deployment

The GitW3 **Deploy** tab registers a verifiable W3DS deployment identity for a published release. It binds the exact code version, deployment environment, connected deployer, and a public application key.

:::important

This flow does not upload or run the application. Deploy the code with your normal hosting provider or pipeline, then use the generated key in that server or runtime when PP-Auth integration is available.

:::

## Prerequisites

Before starting, confirm:

- the platform eName is ready;
- a stable semantic release is published;
- PPA has granted a certificate for that exact version;
- you are signed in with the eID wallet that will act as the deployer; and
- the W3DS deployment publisher is available.

Every deployment belongs to the connected deployer's eName. It does not claim that the platform authors or release committers operated the deployment.

## Step 1: Choose release

Open **Deploy** and select a PPA-certified release. The release binds the version tag and exact commit to the stable platform eName. Uncertified releases remain unavailable.

You can register additional versions later without replacing earlier records.

## Step 2: Describe deployment

Enter a human-friendly name such as `Singapore production`, then choose an environment:

- Production
- Staging
- Development
- Custom

These values distinguish multiple deployments of the same release. They do not configure a hosting region, DNS record, or deployment pipeline.

## Step 3: Bind an application key

Choose one of two key paths:

### Generate a deployment key

This is recommended for a first deployment. GitW3 generates an ECDSA P-256 key pair in the browser and downloads `w3ds-deployment-key.json` immediately. The backup uses the `w3ds-deployment-key-v1` format and contains:

- algorithm metadata for ECDSA P-256 with SHA-256;
- the `z`-prefixed public key;
- the base64-encoded PKCS#8 private key; and
- a creation timestamp.

Confirm that the file was downloaded and stored safely before continuing.

### Use an existing public key

Choose this path when your runtime or secret manager already controls a compatible W3DS P-256 key. Paste only the `z`-prefixed public key. Do not upload or paste the private key into GitW3.

:::danger The private key is shown only through the download

GitW3 receives the public key and cannot recover the private key. Never commit `w3ds-deployment-key.json`, paste it into chat, expose it through an API, or ship it in a browser or mobile bundle.

:::

Store the private file in the hosting provider's secret manager or a read-only server mount. Prefer an environment variable such as `W3DS_DEPLOYMENT_KEY_FILE` that points to the mounted file instead of putting key material in an environment variable.

## Step 4: Review and sign

Review the release, deployment name, environment, deployer identity, and key handling confirmation. GitW3 reserves two identities:

- a **deployment eName** bound to the deployment's public key and connected deployer; and
- a **software-version eName** bound to the stable platform eName, release version, and exact Git commit.

Select **Create identities and continue to wallet**, then scan or open the eID wallet. One wallet signature covers both documents. Nothing is provisioned until the signature is verified.

## Publication and server integration

The deployment card progresses through publishing, waiting for W3DS, published, or needs-attention states. After publication it shows both eNames and a **Use AI to configure the server** helper.

That generated prompt contains the verified public deployment context but not the private key. It asks a coding assistant to:

- inspect the existing server runtime and deployment method;
- add a server-only loader for `w3ds-deployment-key-v1`;
- validate P-256/SHA-256 and ensure the private key derives the expected public key;
- keep key loading unreachable from client code;
- use a secret manager or read-only mount; and
- leave a narrow PP-Auth integration boundary without inventing an unpublished SDK or protocol.

Keep the downloaded private-key file local when using that prompt. PP-Auth SDK integration is marked as coming soon in GitW3; do not invent a package name, endpoint, token format, or wire protocol.

## Rotation and recovery

If the private key is lost, GitW3 cannot restore it. Register a new deployment identity and update the server secret through a controlled rollout. Keep the old secret available only for the rollback window, verify the new public-key match at startup, then revoke or destroy the old secret according to your hosting policy.
