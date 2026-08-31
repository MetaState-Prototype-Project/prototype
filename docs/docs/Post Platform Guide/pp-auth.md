---
sidebar_position: 11
---

# Authenticating your platform

Your deployment proves which release it is running, and the eVault decides what that release may touch. This page is the integration.

For the mechanism itself see [Platform Authentication](/docs/W3DS%20Protocol/Platform-Authentication).

## Install

```bash
pnpm add @metastate-foundation/auth
```

Both halves ship in one package. Deployments import the signer, verifiers import the verifier; nothing stops you doing both, which is what the demonstrator does.

## What your deployment needs

GitW3 produces all of it when you deploy a release. None of it is secret except the private key, which never leaves your process.

```ts
import type { DeploymentIdentity } from "@metastate-foundation/auth/platform";

const identity: DeploymentIdentity = {
  privateKey: process.env.DEPLOYMENT_PRIVATE_KEY!,  // PKCS#8, base64
  evidence: {
    deploymentEname, deploymentName, environment,
    deployerEname, platformEname, versionEname,
    version, releaseTag, commitSha, publicKey,
    deploymentKeyDocument,      // binding document, bundle-signed
    softwareVersionDocument,    // binding document, same signature
    accreditationJws,           // the association's certificate
    issuerJwksUri,
    submissionProof,            // the release proof the association reviewed
  },
};
```

Store the private key the way you store any other deployment secret. If it leaks, the holder can authenticate as your deployment until the deployer revokes the key — it is the whole of the possession proof.

## Authenticating

```ts
import { authenticate } from "@metastate-foundation/auth/platform";

const result = await authenticate(identity, "https://vault.example");
```

That fetches a challenge, signs it, and posts the answer. If you want the two steps yourself — to add retries, or to talk to something other than HTTP — use `answerChallenge(identity, challenge)` and send the response however you like.

## Verifying, if you are the eVault

```ts
import {
  createChallengeStore,
  verifyHandshake,
  authorize,
} from "@metastate-foundation/auth/platform";

const challenges = createChallengeStore();          // module scope, not per request

// POST /pp-auth/challenge
const challenge = challenges.issue(ownerEname);

// POST /pp-auth/verify
const chain = await verifyHandshake(response, {
  audience: ownerEname,
  registryBaseUrl: process.env.PUBLIC_REGISTRY_URL!,
  store: challenges,
});

if (!chain.ok) {
  // chain.links carries all six with a plain-English detail on each.
  return refuse(chain.links.find((link) => !link.ok));
}
```

`chain.claim` is what you learned: platform, deployment, version, level, and the domains it may use.

Then the owner's terms, for each record touched:

```ts
const decision = authorize(policy, {
  claim: chain.claim,
  domain: schema.domain,            // the domain the record's ontology declares
  reputation: score ? { engine, score } : null,
});

if (!decision.allowed) return refuse(decision.reason);
```

`decision.reason` is written to be shown to a person. `decision.code` is for your logs.

Hold the challenge store at module scope. Issuing from one instance and redeeming in another rejects every legitimate handshake, and under Vite's dev server a module evaluated twice will do exactly that.

## Injection points

Three things are injectable, all defaulting to the ordinary behaviour:

- `verifyWalletSignature` — how a wallet signature is checked. Defaults to `signature-validator` against your registry.
- `resolveJwks` — how a JWKS URI becomes keys. Defaults to a cached remote fetch. Supply your own to pin a key set or to run offline.
- `now` — the clock, for testing time-dependent behaviour.

## Testing your integration

`@metastate-foundation/auth/platform/scenario` mints a complete, self-consistent chain from keys it generates, so you can exercise your verifier without a wallet, a registry or a live association:

```ts
import { createTrustRoots, mintDeployment } from "@metastate-foundation/auth/platform/scenario";
```

Everything it produces is genuinely signed and genuinely verified. What differs is the root: the keys standing in for the deployer, the registry and the association are local. **Never configure a production verifier with roots from this module** — a chain that verifies against them proves your code works, not that a platform is trustworthy.

The [demonstrator](/docs/Post%20Platform%20Guide/pp-auth-demonstrator) is built on it and is the fastest way to see the whole thing move.
