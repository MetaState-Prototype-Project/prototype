---
sidebar_position: 6
---

# Platform Authentication (PP Auth)

An eVault has never been able to tell one platform from another. `POST /platforms/certification` mints a year-long token for any name a caller types in, and any registry-signed token bypasses access control outright. So "which platform is this?" has, until now, been answered by whoever asked.

PP Auth replaces that with a chain of trust the caller has to actually hold the keys for. A deployment proves, from scratch on every handshake, which release it is running and what the Post Platforms Association certified that release to do.

## What a deployment proves

Six links, each failing closed. A verifier checks all six and reports all six — an operator debugging a rejected handshake needs the whole trace, not the first problem.

| Link | What it establishes |
|---|---|
| **Possession** | The caller signed a fresh challenge with the deployment key. Without this the rest is public paperwork anyone could replay. |
| **Deployment authorised** | A named person's wallet signed that key for this platform and environment. Authority traces to a human, not a config file. |
| **Bundle integrity** | Both binding documents hash to the values that signature covered, so neither can be swapped independently of the other. |
| **Version identity** | The version eName is derivable from the platform eName and version by UUIDv5. Arithmetic, not a lookup — nothing to spoof and no network call. |
| **Release authorship** | The release's submission proof re-verifies against its registry key-binding certificate. The same proof the association reviewed, checked again rather than taken on trust. |
| **Accreditation** | The association's ES256 certificate verifies against its JWKS, names this platform as `sub` and this exact version, and grants a level and a set of domains. |

If every link holds, the verifier returns a **claim**: the platform, the deployment, the version, the certification level, and the domains — intersected with what the release actually asked for, so a certificate naming more than the submission requested cannot widen it.

## The handshake

```
deployment                                  verifier
    |  POST /pp-auth/challenge                  |
    |------------------------------------------>|
    |  { nonce, audience, issuedAt, expiresAt } |
    |<------------------------------------------|
    |  sign the canonical challenge payload     |
    |  POST /pp-auth/verify                     |
    |  { challenge, evidence, signature }       |
    |------------------------------------------>|
    |                          verify six links |
    |  { ok, links[], claim }                   |
    |<------------------------------------------|
```

A challenge is single-use and short-lived. It is spent the moment it is answered — whether or not the chain holds — so a captured response cannot be replayed even inside its window.

The deployment **presents** its evidence rather than being looked up. That matters: a verifier needs only public endpoints to check it, and never needs read access to the platform's eVault, which is the access the deployment is trying to obtain in the first place.

## Canonical payloads

Three codebases produce these signatures — the eID wallet, GitW3 in Go, and the registry — so the byte-for-byte forms are fixed.

| Signed thing | Payload |
|---|---|
| Handshake challenge | `w3ds:pp-auth:v1:` + base64url(sha256(canonical challenge)) |
| Deployment attestation bundle | `gitw3:deployment:v1:` + base64url(sha256(`signedPayload`)) |
| Release submission | `gitw3:ppa:v1:` + base64url(sha256(`JSON.stringify(statement)`)) |
| Owner access policy | `w3ds:access-policy:v1:` + base64url(sha256(canonical statement)) |

"Canonical" means keys sorted at every depth, matching `getCanonicalBindingDocumentString` in evault-core and the Go implementation in GitW3. The bundle is the exception: its digest is over the `signedPayload` string exactly as stored, not over a re-serialisation of it.

Signatures are accepted as base64url, base58 multibase (`z…`), raw `r‖s`, or DER-wrapped. Public keys are accepted as multibase, `0x`-hex or bare base64. Being strict about the bytes and liberal about how they were written is deliberate: a verifier that insists on one encoding rejects legitimate evidence.

## What certification is not

The association's certificate is a **trust statement, not a permission**. It says what a release was found to be. The eVault stays sovereign and decides for itself what that is worth — see [Access Policy](/docs/W3DS%20Basics/Access-Policy).

Two independent gates, both of which must open:

1. **The certificate.** Is this domain in what the association granted, and in what the release asked for? A social platform certified for `social` and `communication` has no path to `finance` data. Not because the eVault recognises it as a social platform, but because `finance` is not in its certificate and nothing it can present puts it there.
2. **The owner's policy.** Is the level high enough, is the reputation acceptable, is this domain one the owner permits at all?

An owner's policy can only narrow a certificate, never widen it.

## Backwards compatibility

Existing registry-minted platform tokens keep working. The registry stops minting new ones; deployments issued through GitW3 come with the evidence PP Auth needs. The two coexist while platforms migrate.

## Where the code is

`@metastate-foundation/auth/platform` — both halves in one package.

- `verifyDeploymentChain`, `verifyHandshake`, `createChallengeStore` — the verifier
- `answerChallenge`, `authenticate` — the deployment side
- `authorize`, `permittedDomains` — the two gates
- `accessPolicyPayload`, `verifyAccessPolicy` — the owner's terms
- `@metastate-foundation/auth/platform/scenario` — mints a self-consistent chain from local keys, for tests and demonstrations. Never configure a production verifier with roots from it.
