---
sidebar_position: 9
---

# PP Auth demonstrator

Shows platform authentication and domain separation against the live network: real platforms, real certificates from the association, real deployments, and your own eVault.

```bash
pnpm --filter pp-auth-demo dev
```

Then open **http://localhost:4310** and sign in with your wallet. It needs `PPA_AWARENESS_API_KEY` (or `AWARENESS_API_KEY`) to see the network, and `PUBLIC_REGISTRY_URL` to resolve eVaults.

Nothing is seeded. If the platforms page is empty, nothing has been deployed or certified yet — which is a true statement about the network rather than a failure of the app.

## Platforms

Every platform with a deployment or a certification decision, read live. Under each are the deployments actually running it, with the release and commit they were built from.

**Check it** verifies that deployment's chain of trust, from scratch, against records anyone can read:

| Link | Where the evidence comes from |
|---|---|
| Possession | the deployment itself — see below |
| Deployment authorised | the wallet signature on the deployment's key document, resolved through the registry |
| Bundle integrity | the hashes covered by that same signature |
| Version identity | UUIDv5 arithmetic over the platform eName and version |
| Release authorship | the release proof in the platform's own profile, and its registry key-binding certificate |
| Accreditation | the association's ES256 certificate for that exact version |

Five of the six are checked by reading. **Possession is not** — the deployment's private key never leaves the deployment, so a reader cannot answer a challenge on its behalf. That link reports "not attempted" rather than pretending it failed a check that was never made.

If you hold the key — because you are the person who made that deployment — paste it and the challenge is signed for real. It is kept in memory for that process only: never written to disk, never logged, gone on restart. A wrong key produces a genuine signature that genuinely fails.

## Your data

Your own eVault records, grouped by the domain each schema declares. That grouping is what a certificate is written against, so it is also what decides who sees what.

The table shows every certified platform against every kind of data you hold, decided by the real certificate's domains and your real signed terms, using the same `authorize` an eVault would call. A platform certified for `social`, `finance` and `media` is allowed those and refused everything else — with the reason spelled out. It cannot reach your messages or your files, and nothing it presents will change that.

## Permissions

Being certified for a kind of data is not permission to do anything with it. This tab is where that is settled: for each certified platform, a read and a write toggle per domain it was certified for. Nothing else is listed, because anything else is refused before permissions are consulted.

Each change writes an `AccessGrant` into your own eVault as a new revision. Clearing both toggles withdraws the grant rather than deleting it, so the record shows access was taken away rather than never given.

**Deployment keys go in here, before you try anything.** Possession is the one link a reader cannot establish by looking, so whether the key is present decides what a check can even mean. Enter it and the deployment can answer a challenge for real; leave it out and every request stops at the handshake, which is the correct outcome.

**Try a request** then runs one all the way through — a named deployment, an operation, a domain — and reports which of the three gates decided. Turn off write and a write is refused while a read still succeeds; withdraw the grant and the refusal changes from "has not been given permission" to "has been withdrawn".

## Your terms

The association says what a platform was found to be; you decide what that is worth. Set the minimum level, whose reputation scores you accept and the score they must reach, and any domain refused outright.

Signing goes to your wallet. The signing session id **is** the canonical payload of the statement, so what the wallet signs is exactly the digest of your terms — the signature then verifies against the statement on its own, without anyone trusting this app. The terms are published into your own eVault as an `Access Policy` record, world-readable, and the signature is checked again before the write.

Your terms can only narrow a certificate, never widen it. Permitting `finance` does not let a platform reach finance data it was not certified for.

## See also

- [Platform Authentication](/docs/W3DS%20Protocol/Platform-Authentication)
- [Access Policy](/docs/W3DS%20Basics/Access-Policy)
