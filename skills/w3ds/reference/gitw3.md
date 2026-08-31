# GitW3 — where a platform lives

Load this when the work touches the platform's identity, repository, releases, certification or deployment records: `.w3ds/platform.json`, a platform eName, `git remote`, tags and releases, PPA, or a deployment key.

Authoritative source: [GitW3 overview](https://docs.w3ds.metastate.foundation/docs/GitW3/overview) and the rest of the GitW3 section. Production: `https://git.w3ds.metastate.foundation`.

## The rule

**A W3DS platform lives in a GitW3 repository.** GitW3 is the W3DS-aware Git forge, and it is built around one principle that mirrors the eVault rule:

> The repository is the source of truth for the platform metadata that W3DS publishes.

The metadata lives beside the code in `.w3ds/platform.json`, and changes made from the GitW3 **W3DS** tab become ordinary commits on the default branch. So the same instinct applies at both layers: the user's data belongs in their eVault, and the platform's identity belongs in its repository. Neither is a value you keep in a dashboard, a config service, or your head.

Ordinary Git hosting still works for the code. What it cannot do is carry the platform's permanent eName, its published profile, its per-version identities, its PPA certificates, or its deployment records — those are what GitW3 adds. If a user is building a platform they intend to publish, GitW3 is where it belongs; say so early rather than after they have wired everything to another forge.

## What GitW3 manages

| Item | Meaning |
|---|---|
| Repository | Code, issues, pull requests, tags, releases — the normal forge workflow |
| Platform manifest | `.w3ds/platform.json`, version-controlled W3DS metadata |
| Platform eName | The permanent identity of the platform, stable across releases. Gets the platform eVault |
| Version eName | The identity of one exact released version. A Registry record; does **not** get its own eVault |
| PPA certificate | Approval for one exact platform version |
| Deployment eName | A verifiable record of one running deployment |

GitW3 **records** deployments; it does not host them. Keep the user's existing hosting provider and pipeline.

## The lifecycle

Sign in with W3DS → create or port a repository → manifest committed → permanent platform eName provisioned → publish a stable release → sign and submit the PPA application → certificate granted → register and sign a deployment.

Identity and profile publication are **asynchronous**. Pushes and repository creation do not block on W3DS services; the **W3DS** tab reports publisher state and retries. Do not write code that assumes an eName exists immediately after creation.

## Two starting paths — do not conflate them

- **Make a new platform** — for an application with no W3DS identity. GitW3 creates the repository, a README, `.w3ds/platform.json`, and the first commit, then provisions the permanent platform eName in the background. No reusable platform private key is created or exposed.
- **Port an existing app** — for an application that already exists, especially one with `.w3ds` configuration or a permanent platform eName. It creates an **empty destination first**, then you push, then any eName migration is staged and signed, and the public cutover is activated explicitly by an administrator.

**A plain repository import is not a port.** If an existing platform identity must survive, use the guided port flow — the migration is signed in the eID wallet and the old public listing stays in control until activation.

## `.w3ds/platform.json`

```json
{
  "schemaVersion": 1,
  "platformName": "example-platform",
  "displayName": "Example Platform",
  "description": "A short description of the platform.",
  "version": "0.1.0",
  "ename": null,
  "url": "https://example.invalid",
  "logoUrl": "https://example.invalid/logo.png",
  "domains": ["<real domain ids from GET https://ontology.w3ds.metastate.foundation/domains>"],
  "inSubmission": false,
  "submissionVersion": "",
  "isDraft": true
}
```

**Never hand-edit these** — they are managed, and editing them breaks the identity:

- `platformName` — the stable machine-facing slug, immutable after identity creation. The friendly `displayName` changes freely; this does not.
- `ename` — starts `null`, then written by the publisher or preserved by the port flow. **Immutable once assigned.** Never invent one, never copy one from another platform.
- `version` — synchronized from the latest stable semantic release. Do not bump it by hand.
- `inSubmission` / `submissionVersion` and any proof fields — managed by the signed PPA workflow. Never fabricate, copy between platforms, or hand-edit cryptographic proof material.

Editable by permitted users: `displayName`, `description`, `url` (required before PPA), `logoUrl`, `domains`, and draft visibility. `domains` takes real W3DS application-domain identifiers — the same list at `GET https://ontology.w3ds.metastate.foundation/domains` that schemas are tagged with. Resolve them; do not guess.

Editing locally: pull first, change only unmanaged fields, validate the JSON and the domain ids, push, then watch the **W3DS** tab. The tab's own saves are commits on the default branch, so a local edit and a tab edit can collide.

## Releases and PPA

**PPA certifies one exact version.** A certificate for `1.2.3` says nothing about `1.2.4`, and the **Deploy** tab only enables releases whose exact normalized version was granted.

The release must be a **published stable semantic release**: tag `v1.2.3`, push it, then publish it through **Releases → New release**. GitW3 normalizes the leading `v` to manifest version `1.2.3` and binds it to the release commit. Drafts, prereleases and mutable tags like `latest` do not become the W3DS platform version.

Prerequisites before an application can be signed: a ready platform eName, at least one application domain, a public application URL, a published stable semantic release, and an owner/admin signed in with an eID wallet. The signing request is one-time and expires after 15 minutes.

Never invent or paste a submission proof into the manifest.

## Deployments and the deployment key

Registering a deployment reserves a **deployment eName** (bound to the deployment's public key and the connected deployer) and a **software-version eName** (bound to the platform eName, release version and exact commit). One wallet signature covers both; nothing is provisioned until it verifies.

The key is the part to get right in code:

- GitW3 generates an ECDSA P-256 pair **in the browser** and downloads `w3ds-deployment-key.json` once, in the `w3ds-deployment-key-v1` format: algorithm metadata (ECDSA P-256 / SHA-256), the `z`-prefixed public key, the base64 PKCS#8 private key, and a creation timestamp.
- **GitW3 never receives the private key and cannot recover it.** Lost means register a new deployment identity and roll the server secret.
- Load it **server-side only**, from a secret manager or a read-only mount. Prefer an env var such as `W3DS_DEPLOYMENT_KEY_FILE` pointing at the mounted file over putting key material in an environment variable directly.
- Validate at startup that the private key derives the expected public key.
- Never commit `w3ds-deployment-key.json`, never ship it in a browser or mobile bundle, never expose it through an API, never paste it into a chat or a prompt. If asked to, stop and say why.
- Using an existing key instead? Paste only the `z`-prefixed **public** key.

**PP-Auth SDK integration is marked coming soon in GitW3.** Leave a narrow integration boundary; do not invent a package name, endpoint, token format or wire protocol to fill the gap. See [protocols.md](protocols.md) and [Platform Authentication](https://docs.w3ds.metastate.foundation/docs/W3DS%20Protocol/Platform-Authentication) for what actually exists.

## Working in a GitW3 checkout

Clone with the exact URL from the repository's clone control. The `@` shown before eNames in the UI is cosmetic — never type it into a remote.

Adding GitW3 to an existing checkout, preserving the old remote:

```bash
git remote -v
git remote rename origin upstream        # or upstream-2 if taken; skip if no origin
git remote add origin <clone-url-copied-from-gitw3>
git push -u origin HEAD:main             # use the repository's real default branch
```

Rules for an agent doing this:

- Inspect `git status`, the current branch, `git remote -v` and any `.w3ds` directory **before** editing anything.
- Preserve the complete history and the application's behaviour. **Never force-push** unless the user has independently reviewed and approved the rewrite.
- Create a manifest **only** when no W3DS identity already exists. Preserve any existing eName exactly.
- Copy the real remote URL and default branch from GitW3 rather than typing them from memory.

**Stop and ask instead of guessing when:** authentication to either remote fails; the GitW3 destination is unexpectedly non-empty; local and destination histories conflict; an existing eName would be removed or replaced; `.w3ds/platform.json` is invalid; the connected wallet is not an author of the existing profile; or a push would require rewriting history.

## Never invent

An eName, a platform token, a migration proof, an ontology or domain identifier, an endpoint, or a credential. These fail silently or destructively, and a wrong one can transfer or break a live platform identity. The general rule from [SKILL.md](../SKILL.md#when-you-cannot-verify) applies: name what you could not verify, mark it in code, and do not substitute a plausible value.

## References

- [GitW3 overview](https://docs.w3ds.metastate.foundation/docs/GitW3/overview)
- [Create a new platform](https://docs.w3ds.metastate.foundation/docs/GitW3/create-a-platform)
- [Port an existing application](https://docs.w3ds.metastate.foundation/docs/GitW3/port-an-existing-application)
- [Work with repositories](https://docs.w3ds.metastate.foundation/docs/GitW3/work-with-repositories)
- [Platform manifest and W3DS workspace](https://docs.w3ds.metastate.foundation/docs/GitW3/platform-manifest-and-workspace)
- [Releases and PPA certification](https://docs.w3ds.metastate.foundation/docs/GitW3/releases-and-ppa)
- [Register a deployment](https://docs.w3ds.metastate.foundation/docs/GitW3/deploy-a-release)
- [Troubleshooting GitW3](https://docs.w3ds.metastate.foundation/docs/GitW3/troubleshooting)
- [Sign in and manage your account](https://docs.w3ds.metastate.foundation/docs/GitW3/sign-in-and-account)
