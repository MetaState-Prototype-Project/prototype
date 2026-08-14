# Forgejo code sync — commits into the author's eVault

**Date:** 2026-08-14
**Branch:** `feat/forgejoCodeSyncWithEvault` (based off `feat/w3ds-oidc-bridge`)
**Status:** reviewed and ready to build. ACL, admin-token custody, and delivery-reliability decisions made 2026-08-14;
`login_name` carrying the full eName confirmed end to end by source chain across bridge and GitW3 (see
[Verification status](#verification-status)). Deployment path remains open, inherited from the bridge's own
unresolved blocker — not re-litigated here, and does not block implementation.

Paths given without a link refer to upstream Gitea/Forgejo source, not this repository — see
[Verification status](#verification-status) for how confidently each claim is held.

## Problem

[w3ds-oidc-bridge](../../../services/w3ds-oidc-bridge/README.md) lets a person sign into GitW3 with their W3DS
identity. Once they can sign in, the natural next step is that the code they push becomes part of their own record —
written into their eVault rather than living only on GitW3's server.

Same governing constraint as the bridge: GitW3 is kept at a patch surface of zero, so nothing here can touch Forgejo's
source. It has to work through a surface Forgejo already exposes — outbound webhooks and its REST API — the same way
the bridge worked through OIDC rather than a plugin API it doesn't have.

## Approach

A new service, `services/forgejo-code-sync`, registered as a **system webhook** (fires for every repository, no
per-repo setup — matches the "sync every push, best-effort" decision below) receiving Forgejo's `push` event. For each
commit, it resolves the pusher to an eName, fetches the diff, and writes it as a MetaEnvelope into that person's
eVault.

Three decisions were made before this draft, each with a real alternative that was set aside:

**Identity resolution reuses the OIDC bridge's link**, rather than a new mapping table this service owns itself. The
bridge already causes GitW3 to record the ename as `user.login_name` on first sign-in — see
[Identity resolution](#identity-resolution-pusher--eName) — so a second store would just be a second source of truth
for the same fact, and one that could drift from the first if someone re-links.

**The eVault record is the commit/diff, not a whole-file snapshot.** A snapshot-per-push model was considered and set
aside: it would require this service to hold a full second copy of every synced file's current state and reconcile it
on every push, which is exactly what git itself already does. A commit is the unit GitW3 already emits and the unit a
person would recognise as "what I wrote."

**Every push is attempted, not opt-in per repository.** A person who has never linked a W3DS identity simply has no
eName to resolve to, and the push is skipped — silently, not as an error, since "no eVault" is the ordinary case for
most GitW3 accounts, not a failure. This is simpler than a per-repo toggle and costs nothing extra per skipped push
beyond the one lookup below.

## The two contracts

Same shape as the bridge's document: two protocols this service does not get to choose, then its own design.

### Forgejo webhook side

A **system webhook** — Forgejo/Gitea's instance-wide kind, distinct from a *default* webhook (which is only copied
into repos created after it's added). System webhooks fire for every push, on every repo, retroactively, which is what
"best-effort on all pushes" requires. Configured once, by hand or scripted, not per-repo.
([Forgejo webhook docs](https://forgejo.org/docs/latest/user/webhooks/))

Payload shape, from Gitea's `modules/structs/hook.go` (Forgejo has not been checked directly — see
[Verification status](#verification-status)):

```go
type PushPayload struct {
    Ref, Before, After, CompareURL string
    Commits      []*PayloadCommit
    HeadCommit   *PayloadCommit
    Repo         *Repository   // carries Private bool — see Trust model
    Pusher       *User   // the authenticated Forgejo account that ran git push
    Sender       *User
}

type PayloadCommit struct {
    ID, Message, URL string
    Author, Committer *PayloadUser   // free-text git config: name, email, username
    Timestamp time.Time
    Added, Removed, Modified []string
}
```

**`pusher` and each commit's `author` are different things, and only one of them is trustworthy.** `pusher` is the
Forgejo account that authenticated and ran the push. Each commit's `author`/`committer` is whatever `git config
user.name`/`user.email` said on the machine that made the commit — never validated against any Forgejo account, and
trivially set to anyone's name. A rebase, a `git commit --author`, or a laptop with someone else's git config all
produce a mismatch. **This service resolves identity from `pusher`, once per webhook delivery, never from a commit's
own `author` field.** This is the load-bearing trap in this design, in the same category as the bridge's `@` trap —
easy to get right by accident on the happy path, and silently wrong the first time someone force-pushes a rebased
branch authored partly by someone else.

Signature: `X-Forgejo-Signature` (Forgejo renames some Gitea webhook headers, confirmed for this one; `X-Gitea-Signature`
kept for compatibility), HMAC-SHA256 over the raw request body, hex-encoded, checked against the webhook's configured
secret with a constant-time comparison — same requirement as the bridge's `client_secret` check.

**GitW3-verified trap**: checked directly against GitW3's own source
(`services/webhook/shared/payloader.go`'s `AddDefaultHeaders`) — `X-Forgejo-Signature` is the **raw hex digest, no
algorithm prefix**. Forgejo sends a GitHub-compatible `X-Hub-Signature-256` header alongside it (same digest, prefixed
`sha256=`), and it's easy to adapt GitHub-webhook-verification boilerplate that strips a `sha256=` prefix before
comparing — pointed at `X-Forgejo-Signature`'s unprefixed value, that strip silently breaks every signature check.
Compare `X-Forgejo-Signature` directly against the hex digest, no prefix handling.

**The fix, concretely** — two more things beyond the prefix that break this the same way (wrong bytes hashed, or a
timing side-channel), so all three belong in the same implementation, not just the prefix one:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyForgejoSignature(rawBody: Buffer, secret: string, header: string | undefined): boolean {
  if (!header) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(header, "hex");       // X-Forgejo-Signature, used as-is — no "sha256=".slice(7)
  const expectedBuf = Buffer.from(expected, "hex");

  return received.length === expectedBuf.length && timingSafeEqual(received, expectedBuf);
}
```

1. **No prefix stripping** — the trap above.
2. **Hash the raw request bytes, not a re-serialized `req.body`.** Forgejo signs the exact bytes it sent on the
   wire; if Express's JSON body parser re-`JSON.stringify`s the parsed payload before hashing, key ordering or
   whitespace differences make even a correctly-unprefixed comparison fail. Capture the raw buffer explicitly —
   `express.json({ verify: (req, res, buf) => { req.rawBody = buf } })` — and hash `req.rawBody`, never `req.body`.
3. **`timingSafeEqual`, not `===`**, same requirement the bridge's `client_secret` check already has — and check
   `.length` first, since `timingSafeEqual` throws (rather than returning `false`) on a length mismatch, which an
   attacker could otherwise use to distinguish "wrong length" from "wrong bytes."

### eVault side

Fixed by `infrastructure/evault-core`'s GraphQL API and the Registry's platform-certification flow, already used by
[`platforms/calendar/api/src/services/EVaultService.ts`](../../../platforms/calendar/api/src/services/EVaultService.ts):
certify once (`POST {registry}/platforms/certification` with this service's own base URL → bearer token, cached until
near expiry), then `createMetaEnvelope(input: { ontology, payload, acl })` over `{PUBLIC_EVAULT_SERVER_URI}/graphql`
with `X-ENAME: <the pusher's ename>` on each call. The token authenticates the *platform*; the header selects *whose*
eVault the write lands in. This is the pattern to copy — not `PlatformEVaultService.ts` (used by file-manager,
esigner, ecurrency, dreamsync, cerberus), which provisions one eVault owned by the platform itself and is for a
different purpose (platform presence in the Registry, not per-user storage).

**Unlike the calendar platform, `acl` is not a constant `["*"]` here — see [Trust model](#trust-model).**

## Identity resolution: pusher → eName

This is the part with no existing template — every other platform gets the eName from its own login flow. Here, the
person "logging in" (via the bridge, to GitW3) and the event that needs the eName (a push, hours or months later) are
different services, different requests, with nothing linking them but Forgejo's own account record.

**The webhook payload does not carry it.** Traced to the call site: `services/webhook/notifier.go`'s `PushCommits`
builds `pusher` via `convert.ToUser(ctx, pusher, nil)` — `doer` is `nil`. `services/convert/user.go`'s `ToUser` only
populates `LoginName` (and `SourceID`) when `doer.ID == user.ID || doer.IsAdmin`. With `doer` nil, that's always false.
**The ename is never in the webhook**, regardless of how the pusher authenticated. This was verified against source,
not assumed.

**It is reachable one call away.** The same `ToUser` function *does* populate `LoginName` for an admin-authenticated
caller. `GET /api/v1/users/{username}` with an admin personal access token returns `login_name` — which, per the
bridge's own design doc, is where GitW3 stores the full ename (`@` included) after W3DS auto-provisioning. So the
flow per push is: read `pusher.username` from the webhook, call the admin Users API once per unique username, read
`login_name` off the response.

**Detecting "this account has no linked eVault."** Not every GitW3 account signed in through the bridge. A
password-registered account's `login_name` is not an ename. The bridge's claims design guarantees enames always begin
with `@` (`claims.ts`'s sanitiser strips the leading `@` on the way *in*, but `login_name` is what the OIDC flow wrote
verbatim, unstripped — the bridge's own doc confirms `login_name` holds the full ename, `@` included). Treating a
`login_name` that does not start with `@` as "no linked eVault, skip" is a direct, cheap check with no separate
mapping table needed. **Confirmed by source chain, not just the bridge's doc** — see
[Verification status](#verification-status): the bridge's `claims.ts` sets `sub` to the ename verbatim, `@` included,
goth maps `sub` straight to `UserID`, and GitW3 writes `LoginName = gothUser.UserID` verbatim. No stripping happens
anywhere on that path.

**Cache the mapping.** `login_name` does not change on its own, so resolve once per Forgejo username and cache with a
long TTL, invalidated on a 404 (account deleted) rather than polled. Without this, every push does an extra
admin-authenticated API round trip before any actual sync work starts.

**The admin token is new trust this design adds — see [Trust model](#trust-model) for its actual required shape**,
which turned out larger than a simple read-only lookup token once checked against GitW3's real permission model.

## What gets written

One MetaEnvelope per commit, into the pusher's eVault, on a new ontology schema (`services/ontology/schemas/` has no
existing schema shaped for this — `file.json` is for arbitrary S3-backed blobs, no repo/commit/ref fields). Modelled
on the recent ontology schemas' convention (see `communityActivity.json`, `calendarAvailability.json`): rich
`description` fields, an `authorEName` field for consistency even though the envelope already lives in that person's
own eVault, `additionalProperties` decided deliberately rather than left implicit.

```jsonc
// services/ontology/schemas/codeCommit.json
{
  "schemaId": "af7b8ea0-365c-414b-8dbb-5c0cdd6a46b8",
  "title": "CodeCommit",
  "properties": {
    "id": { "type": "string", "description": "commit sha" },
    "repo": { "type": "string", "description": "owner/name" },
    "ref": { "type": "string", "description": "branch the push landed on" },
    "message": { "type": "string" },
    "authorEName": { "type": "string" },
    "committedAt": { "type": "string", "format": "date-time" },
    "added": { "type": "array", "items": { "type": "string" } },
    "removed": { "type": "array", "items": { "type": "string" } },
    "modified": { "type": "array", "items": { "type": "string" } },
    "diffUrl": { "type": "string", "description": "the diff's own S3 URL — see below, never inlined" }
  },
  "required": ["id", "repo", "ref", "message", "authorEName", "committedAt", "diffUrl"]
}
```

**Revised design: the diff is always uploaded to S3, never inlined, and no size cap decides that — a size cap was the
original design, superseded after live testing found two things wrong with it.** The first draft capped diffs at a
configurable size (`FORGEJO_SYNC_DIFF_MAX_BYTES`), inlining under the cap and falling back to a link back to GitW3
above it — mirroring `file.json`'s own `data`-vs-`url` split. Reviewed against an explicit requirement that the diff
must be preserved regardless of size — including sizes inlining was never going to handle — a cap-then-fallback
design doesn't fit: eVault's own GraphQL server caps request bodies at 350MB
(`infrastructure/evault-core/src/index.ts:184`, `bodyLimit: 350 * 1024 * 1024`), and a large blob doesn't belong
inlined into a graph-database node property well under that ceiling either — which is exactly why `file.json`, the
one other ontology schema in this codebase modelling large content, has a `url` field in the first place. So instead
of choosing a cap, every diff is uploaded to the same DigitalOcean Spaces (S3-compatible) bucket
`infrastructure/evault-core/src/services/StorageService.ts` already uses, and only the resulting URL is written into
the MetaEnvelope. **Uploaded directly, not through evault-core's own `uploadFile` GraphQL mutation** — that mutation
exists and is reachable on the same authenticated client this service already builds, but caps at 250MB
(`MAX_FILE_BYTES`) on top of the same 350MB body limit; going straight to S3 (same bucket, same `DO_SPACES_*`
credentials, no new secrets) has no such ceiling.

**The diff-fetch endpoint was also wrong in the original draft, found only by testing against a live private repo, not
by re-reading source harder.** The draft cited `routers/web/web.go:1808`'s `GET /{owner}/{repo}/commit/{sha}.diff` —
real, and gated by `reqRepoCodeReader` in the source, which reads as "needs code-read access, so an admin token
should satisfy it." Tested directly against a running GitW3 instance: the exact same request, same token, three auth
forms tried (`Authorization: token`, HTTP Basic, `?token=`), returned `404` on a private repo and `200` on the same
repo made public. **The web router's `.diff` route does not authenticate a PAT for a private repo at all** — it
evaluates the request as anonymous regardless of credentials, and Forgejo denies anonymous access to a private repo
with `404` rather than `403`, to avoid revealing the repo exists. The fix, also confirmed live: fetch from the **API
router** instead — `GET /api/v1/repos/{owner}/{repo}/git/commits/{sha}.diff`
(`routers/api/v1/repo/commits.go`'s `DownloadCommitDiffOrPatch`, registered under `/api/v1/repos/{owner}/{repo}/git`
in `routers/api/v1/api.go`) — same diff content, but on the standard PAT-aware auth chain the admin token already
proves itself against for the Users API and diff-adjacent calls. Confirmed working on a live private repo with the
same token that 404'd on the web-router path.

**The S3 object's own ACL must mirror the repo's visibility, for the same reason the envelope's ACL does.** Uploading
every diff `public-read` regardless of source-repo visibility would recreate, one layer down, exactly the problem
`deriveAcl` exists to avoid: a private repo's diff would be readable by anyone with the URL, independent of whatever
ACL the eVault envelope itself carries. `content/diff.ts`'s upload call is `public-read` only when
`!task.repoPrivate`; a private repo's diff is uploaded with no public ACL, so its URL is not fetchable without the
bucket's own credentials. There is no presigned-URL-on-read feature built for this — out of scope for this pass;
retrieving a private diff later needs direct bucket access, not a link a browser can just open. **Not fully verified
end to end**: the request correctly carries the ACL header (confirmed against a real S3-compatible server, not just
mocked), but the specific test environment used to check it (a local MinIO instance) doesn't honour legacy per-object
ACLs the way DigitalOcean Spaces does — this is a known difference between MinIO's and AWS/DO's S3 implementations,
not a sign the request is wrong, but it means the actual public/private *enforcement* has only been proven against
evault-core's own already-working use of this same pattern against real DO Spaces, not independently re-verified for
this service's own uploads.

## Architecture

Same shape as the bridge: `services/forgejo-code-sync/`, flat, Express + TypeScript, `.env`-driven required-config
pattern (`src/config.ts`, throws at startup on anything missing — mirrors
[awareness-service's config.ts](../../../services/awareness-service/api/src/config.ts) and the bridge's own).

```
config.ts        env parsing; throws at startup on anything missing
identity.ts       pusher username -> eName, admin API call + TTL cache
evault.ts         certify + per-eName GraphQL client (copy of EVaultService.ts's shape), acl derived from Repo.Private
storage/s3.ts     uploads a diff to the same DO Spaces bucket evault-core uses, ACL mirrors repo visibility
content.ts        fetch a commit's diff from the API router, upload it via storage/s3.ts, return the S3 URL
queue.ts          persisted retry queue — see Delivery reliability, below
webhook/push.ts    verify signature, iterate commits, enqueue
index.ts          wiring, /healthz
```

```
 GitW3 (push)        forgejo-code-sync              Forgejo API           eVault (pusher's)
      │                      │                            │                      │
      ├─ POST /webhook ─────▶│                             │                      │
      │  X-Forgejo-Signature │                            │                      │
      │                      ├ verify HMAC                │                      │
      │                      ├ persist delivery to queue  │                      │
      │◀── 200 (queued) ─────┤                            │                      │
      │                      │                            │                      │
      │                (async, per commit, retried on failure — see below)       │
      │                      ├ pusher.username cached? ────┤ GET /users/:name    │
      │                      │◀─────────────────────────── login_name             │
      │                      ├ login_name starts with @? ─┘ else: skip, dequeue  │
      │                      ├ fetch diff, upload to S3 ───────────────────────────▶ S3
      │                      ├ certify (cached) ──────────────────────────────────▶
      │                      ├ acl = Repo.Private ? owner-only : ["*"]            │
      │                      ├ createMetaEnvelope(codeCommit, X-ENAME, acl) ─────▶
      │                      │◀───────────────────────────────────────── envelope id
      │                      ├ dequeue on success                                 │
```

The webhook handler's own response is now decoupled from whether the sync actually succeeds — it acknowledges receipt
once the delivery is durably queued, and the queue drains asynchronously with its own retry policy. This matters
because of what [Delivery reliability](#delivery-reliability-no-safety-net-from-forgejo) below found: Forgejo will
never redeliver a failed webhook on its own, so responding `200` only after a successful eVault write would just
convert a transient failure into permanent silent loss, indistinguishable from the "no linked eVault" skip case.

One webhook delivery can carry several commits (a multi-commit push); each is queued and processed independently, so
a partial failure (one commit's diff fetch fails) doesn't block the rest.

### Delivery reliability: no safety net from Forgejo

**GitW3-verified, and it changes the reasoning here**: Forgejo has **no automatic retry/redelivery** of failed
webhook deliveries. `services/webhook/deliver.go` records `t.IsSucceed = resp.StatusCode/100 == 2` and
`w.LastStatus`, then stops — there is no requeue/retry logic anywhere in `services/webhook` (checked directly, none
found). The only resend path is a human clicking "Replay" on a specific delivery in the repo's webhook history UI
(`templates/repo/settings/webhook/history.tmpl`, `POST .../replay/{UUID}`) — nothing automatic, nothing that
re-delivers a whole batch on its own.

**Decision: this service owns its own reliability, rather than accepting best-effort loss.** A timeout, an eVault
outage, or a crash mid-batch must not silently drop a push the way an unlinked account silently skips one — those are
different situations (one is expected and permanent, the other is transient and should resolve on retry) and must not
look the same from the outside. `queue.ts` persists each commit-sync task before attempting it, retries with backoff
on failure, and distinguishes — in logs/metrics, not just internally — "skipped, no linked eVault" from "failed,
retrying" from "failed, retries exhausted, needs attention." The last category is the one that needs a real alert;
silently swallowing it would reproduce exactly the invisible-data-loss failure mode this decision exists to avoid.

## Trust model

**HMAC verification is the only thing standing between this service and an attacker POSTing a fabricated push.**
Same posture as the bridge's `client_secret` check: constant-time comparison, secret never logged, raw body bytes
hashed rather than a re-serialized `req.body` — see the concrete implementation under
[Forgejo webhook side](#forgejo-webhook-side).

**The admin token is the new, larger risk this design adds, and it is bigger than the original draft assumed.** The
bridge's signing key can forge an identity; this token can *read* every account's `login_name` and whatever else
`GET /api/v1/users/{username}` returns to an admin — broader blast radius than the bridge needed.

**GitW3-verified, two corrections to the token sizing:**

1. **The exact scope is `read:user`** (`models/auth/access_token_scope.go:83`, category
   `AccessTokenScopeCategoryUser`) — that part narrows cleanly. But **scope is not what gates `login_name`; the
   account's admin flag is.** `services/convert/user.go`'s `toUser` only fills in `LoginName` when
   `authed = doer.ID == user.ID || doer.IsAdmin` (lines 24, 77-85). A `read:user`-scoped PAT belonging to a
   *non-admin* account will call `GET /users/{username}` successfully but get back `login_name: ""` for anyone but
   itself — there is no scope that substitutes for the account actually being a site admin. So "narrowest scope" and
   "must be a site-admin's token" are both true and independent constraints.
2. **This same token also needs to cover diff fetching** (see the `.diff` note under
   [What gets written](#what-gets-written)) — the commit-diff route requires `read:repository`
   (`services/context/permission.go:65-76` rejects a scoped token missing it) plus `ctx.Repo.CanRead`, which an
   admin account satisfies for any repo regardless of collaborator status. Practically: **one PAT, scopes
   `read:user,read:repository`, on a site-admin account.**

**Decision: a dedicated site-admin service account, not a human admin's personal token.** Given the token's blast
radius — it can read `login_name` and repo content for every account and every repo on the instance, not just what
this service needs at any given moment — it is provisioned as its own account, created for this purpose alone, not
borrowed from whoever happens to administer GitW3. It is stored and rotated with the same care as the bridge's
`W3DS_OIDC_SIGNING_KEY`: never committed, never logged, and treated as a high-value secret in whatever secret store
the eventual deployment uses. This does not shrink the token's actual capability — Forgejo's permission model doesn't
offer anything narrower that still satisfies `login_name` and private-repo diff access — so the mitigation is
isolation and custody, not scope reduction.

**Decision: ACL on the written envelope mirrors the repo's visibility, not a constant.**
`EVaultService.ts` writes `acl: ["*"]` unconditionally because a calendar event is meant to be readable by whoever
the person shares it with via the platform. Code from a private repository is not that — defaulting to `["*"]` here
would make private source world-readable the moment it's synced, independent of GitW3's own visibility setting. So
this service conditions the write on the signal already present in every push payload at no extra cost:
`Repository.Private` (`modules/structs/repo.go:57`, confirmed present). `acl: [eName]` when the repo is private at
push time, `acl: ["*"]` when public — `[eName]` confirmed as the codebase's own convention for a restricted ACL, the
one precedent being `infrastructure/evault-core/src/services/BindingDocumentService.ts:298,378`'s
`acl: [normalizedSubject]`; every other write anywhere in the codebase uses `["*"]` with no exception.

**Known limitation, confirmed against `evault-core`'s own access-control code, not assumed: "owner-only" here means
"not public," not "restricted to the owner."** `vault-access-guard.ts`'s `checkAccess` — the resolver path for a
single envelope fetched by ID — grants access to **any request carrying a valid Registry-issued Bearer token from any
certified platform**, without consulting the envelope's `acl` at all in that branch; the ACL is only actually checked
against an anonymous request (no valid token) or inside the bulk `metaEnvelopes` list query, which has no such
bypass. So `acl: [eName]` reliably keeps a private-repo commit out of anonymous reach and out of another platform's
list-query results, but does **not** stop a different certified platform from reading the same envelope directly by
ID if it already has the ID and the right `X-ENAME` — there is nothing this service can do about that without
patching `evault-core` itself, which is out of scope here. Documented rather than fixed: `acl: [eName]` is still
strictly better than `acl: ["*"]` (it removes the public and cross-platform-browsing exposure), and matches the one
real precedent for restricted data in this codebase, but it is not the airtight privacy guarantee the word
"owner-only" might otherwise suggest.

**Known limitation, accepted rather than solved: visibility is captured at push time, not kept in sync afterward.**
If a repo is public when a commit is pushed — so its envelope is written `acl: ["*"]` — and is later flipped private
on GitW3, the already-synced envelope stays world-readable. This service has no trigger for a later visibility change
and does not re-scan already-synced commits. The symmetric case (private → public) similarly does not retroactively
open up envelopes synced while private. Closing this gap would require either polling every synced repo's current
visibility on some schedule or GitW3 emitting a visibility-change event, and neither exists today — this is a real,
named gap, not an oversight.

**Transport.** Both the inbound webhook and the outbound admin-API call need TLS in any environment beyond local dev,
for the same reason as the bridge: the webhook secret and the admin token are both bearer credentials with no other
protection in transit.

## Deployment

Inherits the bridge's own unresolved blocker: **no service deployment manifest exists in this repository for a
production or staging host.** `docker-compose.gitw3.yml` is explicitly a candidate, not a convention. This spec
doesn't attempt to resolve that a second time — whatever answer the bridge's deployment gets, this service follows.
That decision was reaffirmed in review rather than revisited: it doesn't block writing the implementation plan or the
code, only an actual staging rollout, matching how the bridge's own spec left it.

What's specific to this service, once a host is known:

- `docker/Dockerfile.forgejo-code-sync`, following the `docker/Dockerfile.<name>` convention.
- The system webhook can be scripted, but not via CLI. **GitW3-verified**: `cmd/` has no webhook subcommand at all
  (checked — nothing under `cmd/*.go` matches), so this is not analogous to how
  [`docker/gitw3-register-auth-source.sh`](../../../docker/gitw3-register-auth-source.sh) scripts the auth source via
  `gitea admin auth add-oauth`. It doesn't need to be: the Admin REST API already does this —
  `POST /api/v1/admin/hooks` (`routers/api/v1/admin/hooks.go`'s `admin.CreateHook`, mounted in `routers/api/v1/api.go`
  around line 1365) accepts a `CreateHookOption` body and creates exactly the "system webhook" Site Administration's
  UI creates, scoped instance-wide. So this is scriptable — a small `curl`/script against that endpoint with an
  admin token, run once at provisioning time — just via the API instead of a CLI subcommand.
- The retry queue (see [Delivery reliability](#delivery-reliability-no-safety-net-from-forgejo)) needs somewhere to
  persist pending deliveries across a restart — not necessarily a new database if this service ends up sharing
  infrastructure with something else already deployed, but not nothing either. Left open pending the same
  deployment-path answer as everything else in this section.

| Variable | Note |
|---|---|
| `FORGEJO_SYNC_PUBLIC_URL` | this service's own base URL, used for Registry platform certification |
| `FORGEJO_SYNC_PORT` | |
| `FORGEJO_WEBHOOK_SECRET` | HMAC secret configured on the Forgejo system webhook |
| `FORGEJO_API_URL` | GitW3's base URL, for the admin Users API call |
| `FORGEJO_ADMIN_TOKEN` | PAT on a **dedicated site-admin service account** created for this service alone (not a shared human admin's token), scopes `read:user,read:repository` — see [Trust model](#trust-model) for why both scopes and the admin flag are required |
| `PUBLIC_REGISTRY_URL` | already in the root `.env` |
| `PUBLIC_EVAULT_SERVER_URI` | already used by the calendar platform's `EVaultService.ts` |
| `DO_SPACES_ENDPOINT`, `DO_SPACES_REGION`, `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_BUCKET`, `DO_SPACES_CDN_URL` | already in the root `.env` — the same bucket `infrastructure/evault-core/src/services/StorageService.ts` uses. No service-specific S3 credentials needed |

## Testing

Same split as the bridge: pure logic first, wallet/Forgejo-dependent behaviour second.

**Unit — `identity.ts`.** `login_name` starting with `@` resolves; one that doesn't is treated as "no eVault," not an
error; cache hit skips the API call; a 404 evicts the cache entry.

**Unit — signature verification.** Valid HMAC accepted; one byte flipped in the body rejected; missing header
rejected; a `sha256=`-prefixed value naively compared against the unprefixed header rejected as a regression guard
for the trap above — same shape as the bridge's `client_secret` tests.

**Unit — `content.ts`.** Fetches from the API router's `git/commits/{sha}.diff`, not the web router's
`commit/{sha}.diff` — a regression guard specifically for the trap above. Uploads with `public-read` for a public
repo, no public ACL for a private one. Throws — does not degrade to a fallback — on a fetch failure, a non-2xx
response, or an S3 upload failure, since there is no longer a lesser alternative to fall back to.

**Unit — `evault.ts` ACL derivation.** `Repo.Private: true` produces an owner-only `acl`; `false` produces `["*"]`;
the derivation is a pure function of the payload, independent of the identity lookup.

**Unit — `queue.ts`.** A task that fails is retried with backoff, not dropped; one that exhausts retries is marked
distinguishably from one that's still pending, and distinguishably from an ordinary "no eVault" skip; a queued task
survives a process restart (persisted, not in-memory only).

**End to end, no real Forgejo webhook needed for the eVault half.** The Dev Sandbox provisions an eVault; combined
with the bridge's own local flow (sign into a local GitW3 via W3DS, which is what sets `login_name`), a real
`login_name` can be read and a synthetic webhook payload POSTed directly at this service to exercise the full chain
without needing a live push.

**Done, not just planned: a real push against a real system webhook, on a live GitW3 instance with a real
W3DS-linked account.** Registered the system webhook via the provisioning script against a running GitW3
(`v16.0.2-9`), pushed a real commit to a real repo (public, then flipped private) owned by an account already linked
through the bridge, and confirmed a `codeCommit` MetaEnvelope landed with the correct `acl` — checked directly
against Neo4j, not just the GraphQL read path (see the caveat about that read path below). This is what surfaced both
corrections in this section: the original size-cap design and the web-router diff endpoint. Two operational findings
from that run, not code defects: Forgejo's `ALLOWED_HOST_LIST` blocks a webhook targeting a loopback address by
default, which only bites when the target happens to be `localhost` relative to GitW3 (true in this local setup, not
expected to be true of a real deployment — see [Deployment](#deployment)); and registering more than one webhook
pointed at this service's URL produces one envelope per delivery received, since the service has no reason to assume
two separate deliveries describe the same event — an operational hazard (don't register it twice), not something the
service should paper over with deduplication it can't actually justify.

**A gap found during that same live run, in `evault-core`, not this service, not yet acted on.** Querying
`metaEnvelopes` with a valid platform-certification token and *any* certified platform's identity — including one
that was never registered anywhere, just self-certified via the open `/platforms/certification` endpoint — returned
a private, owner-only-ACL'd envelope in full. Traced to the cause: `graphql-server.ts:237`'s `metaEnvelopes` resolver
returns a Relay-style connection object (`{edges, pageInfo, totalCount}`), not a bare array, so
`vault-access-guard.ts`'s `filterEnvelopesByAccess` — the actual ACL check — never runs for it; the middleware's
array-detection branch only applies to a bare array, and the connection-object branch (`filterACL`) only strips a
top-level `acl` field, which a connection wrapper doesn't have. **Practical effect: `acl: [eName]` currently provides
no protection at all against this specific query, for any certified platform.** This is `evault-core`'s bug, not
fixable from this service, and worse than the single-ID-lookup gap already documented below — raised here rather
than silently left for someone else to rediscover.

**Staging / real Forgejo.** The local run above substitutes for most of what this note originally asked for. What's
still genuinely staging-only: TLS termination, a site-admin service account that isn't also someone's personal login,
and confirming the whole chain behaves the same once `forgejo-code-sync` and GitW3 are not on the same host.

## Acceptance criteria

| # | Criterion | Covered by |
|---|---|---|
| 1 | A push from a W3DS-linked GitW3 account writes commit records into that person's eVault | webhook → identity resolution → `createMetaEnvelope` |
| 2 | A push from an account with no linked eVault is skipped without error | `login_name` not starting with `@` → skip, dequeue |
| 3 | Commit authorship is never taken from unverified git commit metadata | identity resolved from `pusher`, never from `commit.author` |
| 4 | A commit's diff is preserved regardless of size | uploaded to S3, never inlined into the eVault write — see [What gets written](#what-gets-written) |
| 5 | Private-repo code is not made world-readable by the act of syncing it | `acl` derived from `Repo.Private` — see known limitation in [Trust model](#trust-model) |
| 6 | A transient failure (eVault outage, timeout, crash mid-batch) does not silently lose a push's sync | persisted retry queue — see [Delivery reliability](#delivery-reliability-no-safety-net-from-forgejo) |

## Open items

None blocking implementation. Every item from the original draft was resolved during review — either by checking
directly against GitW3's actual pinned source (`v16.0.2`, not upstream Gitea by analogy; see the inline
"GitW3-verified" notes throughout and [Verification status](#verification-status) below), or by an explicit product
decision — ACL, admin-token custody, and delivery reliability, see [Trust model](#trust-model) and
[Delivery reliability](#delivery-reliability-no-safety-net-from-forgejo) — or, for `login_name`'s format, by chaining
three independently-verified facts across the bridge and GitW3 source (see
[Identity resolution](#identity-resolution-pusher--eName) and [Verification status](#verification-status)).

Two things remain genuinely out of scope for this document rather than unresolved by it:

- **Deployment path** — shared with the bridge's own unresolved blocker. An infrastructure/ownership question, not
  something either repo's source can answer; does not block writing or running this service locally.
- **Where the retry queue persists** — depends on the same deployment answer above; noted under
  [Deployment](#deployment) rather than repeated here.

**The live smoke test this section previously called "still worth doing" has been done.** A real linked account,
signed in via the bridge on a live GitW3 instance, pushed real commits; the resulting envelopes and their ACLs were
checked directly against Neo4j. See [Testing](#testing) for what that run found — two design corrections (the diff
storage redesign and the web-router-vs-API-router diff endpoint) and one `evault-core` bug (the `metaEnvelopes`
list-query ACL gap), none of which surfaced from reading source alone.

## Verification status

Everything under [Identity resolution](#identity-resolution-pusher--eName) that cites `notifier.go`/`convert/user.go`
was checked directly against upstream Gitea source (`go-gitea/gitea`, `main` branch) during drafting, not assumed —
these are the two negative/positive findings this whole design depends on (ename absent from the webhook, present via
the admin API) and were the most important thing to get right before writing anything else.

**Updated by a later review pass against GitW3's actual repository** (`/Users/sahil/orca/workspaces/gitw3`, pinned
`v16.0.2`, not upstream Gitea by analogy). Everything below was re-checked line-by-line against that source and is
now confirmed to hold on GitW3 specifically, superseding the "Gitea-sourced by analogy, not checked" caveat this
section originally carried for these items. **Independently spot-checked a second time**, directly against the same
GitW3 checkout, before folding these into the decisions above: `AddDefaultHeaders`'s unprefixed
`X-Forgejo-Signature`, the absence of retry/redeliver/requeue anywhere under `services/webhook`, the `read:user`
scope constant, `ToUser`'s admin-only `LoginName` gate, and `Repository.Private`'s presence on the payload struct all
match as claimed below.

- `PushPayload`/`PayloadCommit`/`PayloadUser` struct shapes (`modules/structs/hook.go`) — match as drafted.
- `notifier.go`'s `PushCommits` calling `convert.ToUser(ctx, pusher, nil)` and `ToUser`'s `authed` gating
  (`services/convert/user.go:16-27,49-87`) — match as drafted, including that `doer == nil` on the webhook path
  makes `authed` always false, so `LoginName` is never in the webhook payload.
- `GET /users/{username}` populating `LoginName` only for an admin-or-self caller (`routers/api/v1/user/user.go:134`)
  — confirmed, and the required scope is `read:user` exactly (`models/auth/access_token_scope.go:83`) — but scope
  alone is not sufficient, the calling account must itself have `IsAdmin=true`.
- The `.diff`/`.patch` commit-URL suffix — real, at `routers/web/web.go:1808` → `repo.RawDiff`, gated by
  `reqRepoCodeReader`, which for a scoped token additionally requires `read:repository`.
- `X-Forgejo-Signature`'s exact byte format (raw hex, unprefixed) vs. the `sha256=`-prefixed `X-Hub-Signature-256`
  Forgejo sends alongside it (`services/webhook/shared/payloader.go`'s `AddDefaultHeaders`).
- System webhooks are scriptable via `POST /api/v1/admin/hooks` (`routers/api/v1/admin/hooks.go`) — no CLI
  subcommand exists, but none is needed.
- Webhook delivery has **no automatic retry/redelivery** on failure anywhere in `services/webhook` — the only resend
  is a human-triggered "Replay" in the web UI.
- OAuth2's `LoginName` assignment (`routers/web/auth/oauth.go:1141,1602`) uses `gothUser.UserID` verbatim in both the
  new-account and existing-account lookup paths — consistent with the bridge doc's claim about what `login_name`
  ends up holding.
- `Repository.Private bool` (`modules/structs/repo.go:57`) — confirmed present on the webhook's `Repo` field.

Not re-checked in this pass (still analogy-only or out of GitW3's scope to verify): anything this service calls that
isn't one of the endpoints listed above.

**The bridge's own `sub`-claim content, closed by a third pass, this time against the bridge's own source rather than
GitW3's.** `services/w3ds-oidc-bridge/src/claims.ts:171` — `buildClaims` returns `sub: ename` verbatim. The only
transformation applied to the ename anywhere in that file is `stripLeadingAt`, and it is used exclusively inside
`sanitiseUsername` (for `nickname`/`preferred_username`) and `emailLocalPart` — never on `sub`. So the full chain is
now confirmed across all three parties with no remaining analogy or assumption:

```
bridge:  sub = ename, "@" included           (claims.ts:171, this pass)
goth:    UserID = ID token's "sub" claim      (openidConnect.go, cited in the bridge's own design spec)
GitW3:   LoginName = gothUser.UserID verbatim (oauth.go:1141,1602, previous pass)
────────────────────────────────────────────────────────────────────────────
         login_name on a linked account = the full, "@"-prefixed eName
```

This closes the one item the previous pass left as a live-instance-only check — it turned out answerable from source
on all three sides, so no running instance was required to hold it with confidence.
