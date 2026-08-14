# forgejo-code-sync

Syncs commits pushed to GitW3 into the pushing author's own eVault, and keeps a full up-to-date copy of the repo in
its **owner's** own eVault - two independent sync paths off the same webhook, see [What gets synced](#what-gets-synced).

**Design:** [docs/superpowers/specs/2026-08-14-forgejo-code-sync-design.md](../../docs/superpowers/specs/2026-08-14-forgejo-code-sync-design.md)
**Plan:** [docs/superpowers/plans/2026-08-14-forgejo-code-sync-plan.md](../../docs/superpowers/plans/2026-08-14-forgejo-code-sync-plan.md)

## The two contracts

**Forgejo side** is a system webhook - configured once, instance-wide, no per-repo setup - delivering every `push`
event. `pusher.login` identifies the authenticated account that ran `git push`; each commit's own `author`/`committer`
fields are free-text `git config`, never validated against any Forgejo account, and this service never resolves
identity from them. The webhook's `X-Forgejo-Signature` header is a raw, unprefixed HMAC-SHA256 hex digest over the
exact request bytes - not the GitHub-style `sha256=`-prefixed `X-Hub-Signature-256` Forgejo sends alongside it for
compatibility.

**eVault side** is the same certify-then-per-eName-GraphQL pattern used by
[`platforms/calendar/api/src/services/EVaultService.ts`](../../platforms/calendar/api/src/services/EVaultService.ts):
this service certifies itself with the Registry once, then writes into *the pusher's own* eVault by presenting their
eName as `X-ENAME` on each write.

The identity link between the two is the [w3ds-oidc-bridge](../w3ds-oidc-bridge/README.md): once someone signs into
GitW3 through it, GitW3's `login_name` for that account holds their full eName (`@` included). This service resolves
`pusher.login -> login_name -> eName` via `GET /api/v1/users/{username}`, which only returns `login_name` to an
admin-authenticated caller - see [Configuration](#configuration) for what that requires of `FORGEJO_ADMIN_TOKEN`.

## What gets synced

One MetaEnvelope per commit (`services/ontology/schemas/codeCommit.json`), written into the pusher's eVault with an
`acl` that mirrors the source repository's visibility at push time: `["*"]` for a public repo, owner-only for a
private one. A commit's diff is inlined when it fits under `FORGEJO_SYNC_DIFF_MAX_BYTES`, and replaced with a
`diffUrl` pointer back to GitW3 otherwise - or on any fetch failure, so an oversized or momentarily unreachable diff
never blocks the commit's own metadata from being synced.

A push from an account with no linked eVault (`login_name` doesn't start with `@`) is skipped silently - the ordinary
case for most GitW3 accounts, not a failure.

**A second, independent path off the same webhook** writes the repo's complete current state - every file and
folder, via GitW3's archive endpoint, uploaded to S3 - into the **owner's** own eVault
(`services/ontology/schemas/repoSnapshot.json`), replaced in place on every push rather than accumulating one
envelope per push. `repository.owner.login`, not `pusher.login`, is resolved the same way (`IdentityResolver` is
generic over any Forgejo username); an org-owned repo or an owner with no linked eVault skips the same way an
unlinked pusher does. See the spec's [Repo-owner full snapshot](../../docs/superpowers/specs/2026-08-14-forgejo-code-sync-design.md#repo-owner-full-snapshot-added-2026-08-15)
section for the full design and live-verification detail.

## Delivery reliability

Forgejo has no automatic retry or redelivery of failed webhook deliveries at all - confirmed against GitW3's own
`services/webhook/deliver.go`. So this service owns its own reliability: every commit is durably queued to disk
(`.queue/` locally - see [Deployment](#deployment)) before the webhook handler responds, and a failed sync is retried
with exponential backoff rather than dropped. A task that exhausts its retry budget is left on disk in an `exhausted`
status - logged distinctly from an ordinary skip - rather than silently removed, since it needs a human.

The repo-owner snapshot sync has its own independent queue (`.queue-snapshots/`), same reliability discipline, same
skip/retry/exhausted semantics - a slow or down eVault delays the owner's snapshot the same way it delays a pusher's
commit, and neither queue's failure affects the other's.

## Configuration

Read from the repository root `.env`, same `required()`-throws-at-startup pattern as the bridge's own `config.ts`.

| Variable | Default | Note |
|---|---|---|
| `FORGEJO_SYNC_PUBLIC_URL` | - | this service's own base URL, used for Registry platform certification and to build the webhook URL registered on GitW3 |
| `FORGEJO_SYNC_PORT` | `4300` | |
| `FORGEJO_WEBHOOK_SECRET` | - | HMAC secret configured on the Forgejo system webhook |
| `FORGEJO_API_URL` | - | GitW3's base URL |
| `FORGEJO_ADMIN_TOKEN` | - | PAT on a **dedicated site-admin service account**, scopes `read:user,read:repository` - see below |
| `FORGEJO_SYNC_DIFF_MAX_BYTES` | `131072` | inline cap before falling back to `diffUrl` |
| `PUBLIC_REGISTRY_URL` | - | already in the root `.env` |
| `PUBLIC_EVAULT_SERVER_URI` | - | already in the root `.env` |

### Why the admin token has to be this big

`GET /api/v1/users/{username}` only returns `login_name` when the caller is the account itself or a site admin -
scope alone doesn't gate it, confirmed against `services/convert/user.go`'s `toUser`. Fetching a private repo's diff
separately requires `read:repository`. So `FORGEJO_ADMIN_TOKEN` has to be a PAT belonging to an actual site-admin
account, not merely one carrying those scopes - and because that token can read every account's `login_name` and
every repo's content, not just what this service needs at a given moment, it should be a service account created for
this purpose alone, never a shared human admin's personal token. See the spec's Trust model for the full reasoning,
including the accepted limitation this implies for the ACL decision below.

## Running locally

```bash
pnpm --filter forgejo-code-sync dev
```

Then register the webhook against a local GitW3 instance (idempotent - safe to re-run):

```bash
pnpm --filter forgejo-code-sync register-webhook
```

`GET /healthz` returns `200` once the service is up. Pushing to a repo whose owner has signed into that GitW3 through
the bridge should produce a `codeCommit` MetaEnvelope in their eVault within one drain cycle (5s).

## Testing

```bash
pnpm --filter forgejo-code-sync test
```

Everything through identity resolution, signature verification, ACL derivation, the retry queue, and the drain loop
is covered without a live GitW3, eVault, or Registry - every external call is stubbed. What isn't covered by
automated tests: a real end-to-end run against a live GitW3 + bridge + eVault, which needs the same manual walkthrough
the bridge's own README describes for testing without a phone, extended by pushing a commit as the final step - see
the plan's Phase 6.

**Live verification, done three times, not just planned.** See the spec's Testing section for all three passes: the
first live push (public/private repo, unlinked-account skip, single-webhook regression, plus two GitW3
webhook-provisioning traps found only by testing); the 2026-08-15 follow-up that closed the one gap the first pass
left open - a real differential proof that a private-repo diff's S3 object is anonymously unreachable while a public
one isn't, plus a fourth webhook trap (`PATCH /admin/hooks/{id}` silently ignores a secret rotation - fixed in
`scripts/register-webhook.ts`, which now deletes and recreates instead of patching); and the same day's repo-owner
snapshot pass - the archive endpoint found and live-verified before any code was written against it, a real two-push
sequence proving update-in-place (same envelope id, S3 object content changed), the same S3 ACL differential proof
applied to a repo archive, and the org/unlinked-owner skip path exercised live.

## Deployment

Inherits the bridge's own unresolved blocker: **no service deployment manifest exists in this repository for a
production or staging host.** See the spec's Deployment section. `docker/Dockerfile.forgejo-code-sync` follows the
`docker/Dockerfile.<name>` convention once a host is known.

Where the retry queue persists in a real deployment is part of that same open question - the local default is a
`.queue/` directory next to the package (gitignored), which is enough for development but not a production storage
decision.
