# Implementation plan — Forgejo code sync

**Spec:** [2026-08-14-forgejo-code-sync-design.md](../specs/2026-08-14-forgejo-code-sync-design.md)

**Status: Phases 0–5 built and passing (89 tests), Phase 6 run once against a live GitW3 instance.** Tasks 1.5, 4.1
and 4.2 below describe the *original* cap-then-inline diff design, superseded after that live run found it wrong in
two ways — see the spec's "What gets written" for the corrected design (diff always uploaded to S3, never inlined;
fetched from the API router's `git/commits/{sha}.diff`, not the web router's `commit/{sha}.diff`, which doesn't
authenticate a PAT for a private repo at all). Left as-written below for the historical record of what was actually
tried and why it changed, rather than silently edited to look right in hindsight.

Rationale lives in the spec; this document is the order of work and how each step is proved. Every task states its
verification. A task is not done until its verification passes.

Conventions taken from the bridge's own plan: `vitest run` as the `test` script, Biome for format and lint, `tsc
--noEmit` as `check-types`, config read from the root `.env` through a `required()` helper that throws at startup.

Phases 1–3 are fully testable with no live GitW3 instance, no eVault, and no admin token — everything in them is a
pure function or stubbed at its one external call. Do not skip ahead: the identity-resolution and ACL logic is where
the spec's traps live (pusher vs. commit author, `login_name`'s `@` check, `Repo.Private` → ACL), and it is the part
that can be tested exhaustively before anything depends on a real Forgejo instance being reachable.

---

## Phase 0 — Scaffolding

**0.1 Create the package.** `services/forgejo-code-sync/` with `package.json` (name `forgejo-code-sync`, `type:
module`), `tsconfig.json`, `tsconfig.build.json`, `README.md`. Scripts: `dev`, `build`, `start`, `test`, `test:watch`,
`check`, `check-types` — same set as `services/w3ds-oidc-bridge/package.json`. Dependencies: `express`, `dotenv`,
`graphql-request` (matches `EVaultService.ts`'s client, not a new GraphQL dependency). Dev: `vitest`, `typescript`,
`@types/*`, `tsx`.

Picked up by `services/*` in `pnpm-workspace.yaml` — no workspace change needed.

> **Verify:** `pnpm install` resolves; `pnpm --filter forgejo-code-sync check-types` passes on an empty `src/index.ts`.

**0.2 Add env keys to `.env.example`** — the full table from the spec's [Deployment](../specs/2026-08-14-forgejo-code-sync-design.md#deployment)
section. Do not touch `.env`.

> **Verify:** every key in the spec's table appears in `.env.example`.

**0.3 Mint the ontology schema.** `services/ontology/schemas/codeCommit.json`, generating a fresh `schemaId` (a UUID
— check it doesn't collide with an existing one in the directory), fields as specced under
[What gets written](../specs/2026-08-14-forgejo-code-sync-design.md#what-gets-written). The ontology service
(`services/ontology/src/index.js`) loads every `.json` file in that directory at startup with no registration step
beyond adding the file.

> **Verify:** `pnpm --filter ontology dev` (or however that service is started locally) logs one more loaded schema
> than before; `GET /schemas/:uuid` on the new id returns the file's contents unchanged.

*Commit: `chore(forgejo-code-sync): scaffold the service package and mint the CodeCommit ontology schema`*

---

## Phase 1 — The pure core

No HTTP, no network calls in this phase. Everything here is a function, mirroring the bridge's own Phase 1 split.

**1.1 `src/config.ts`.** Parse and validate env with `required()`, mirroring
[awareness-service's config.ts](../../../services/awareness-service/api/src/config.ts) and the bridge's own. Load the
root `.env` by relative path.

> **Verify:** unit tests — missing key throws naming that key.

**1.2 `src/identity.ts`, the pure half.** A function `enameFromLoginName(loginName: string): string | null` — returns
the ename when `loginName` starts with `@`, `null` otherwise. This is the entire "no linked eVault" detection logic
from the spec's [Identity resolution](../specs/2026-08-14-forgejo-code-sync-design.md#identity-resolution-pusher--eName)
section, kept as a one-line pure function precisely so it can be tested without the admin API call that surrounds it
(added in Phase 3).

> **Verify:** unit tests — `"@alice"` → `"@alice"`; `"alice"` (no `@`, an ordinary password account) → `null`; empty
> string → `null`.

**1.3 `src/webhook/signature.ts`.** `verifyForgejoSignature(rawBody: Buffer, secret: string, header: string |
undefined): boolean`, exactly the implementation already written out in the spec's
[Forgejo webhook side](../specs/2026-08-14-forgejo-code-sync-design.md#forgejo-webhook-side) section: `createHmac`
over the raw bytes, compared with `timingSafeEqual` against the **unprefixed** hex digest, length-checked first.

> **Verify:** unit tests — a valid signature over a fixed body/secret pair accepted; one byte flipped in the body
> rejected; a `sha256=`-prefixed value (the GitHub-boilerplate trap the spec calls out) rejected as a regression
> guard, not just an absent header; a missing header rejected without throwing.

**1.4 `src/evault/acl.ts`.** `deriveAcl(repoIsPrivate: boolean, eName: string): string[]` — `["*"]` when `false`,
`[eName]` when `true`.

**Confirmed against `infrastructure/evault-core` source, not guessed.** `typedefs.ts:153,283,292` — `acl: [String!]!`,
a plain string array. `"*"` is special-cased as public everywhere it's checked
(`vault-access-guard.ts`'s `checkAccess`/`filterEnvelopesByAccess`). Every write in this entire codebase uses
`acl: ["*"]` except one: `infrastructure/evault-core/src/services/BindingDocumentService.ts:298,378` writes
`acl: [normalizedSubject]` / `acl: [bindingDocument.subject]` — a single-entry array holding the subject's eName.
That's the one real precedent for a restricted ACL anywhere in the codebase, and it's what `[eName]` is modelled on.

**Known limitation of that protection, confirmed while checking the syntax — document it, don't try to fix it
here.** `vault-access-guard.ts`'s `checkAccess` (the single-envelope-by-ID lookup path) grants `hasAccess: true`
whenever the caller presents **any valid Registry-issued Bearer token from any certified platform** — not
specifically the platform that wrote the envelope — without consulting `metaEnvelope.acl` in that branch at all. The
ACL is only actually enforced when no valid Bearer token is present (an anonymous request), and in
`filterEnvelopesByAccess` (the bulk `metaEnvelopes` list query, which has no such bypass). So `[eName]` reliably
blocks anonymous reads and keeps the envelope out of another platform's list-query results, but does **not** block a
different certified platform from reading the exact same envelope via a direct by-ID lookup if it already knows the
envelope's ID and the right `X-ENAME`. This is `infrastructure/evault-core`'s existing authorization model, not a bug
introduced here, and changing it is out of scope for this service — but "owner-only" in this codebase means "not
public or anonymously/cross-platform-listable," not "cryptographically restricted to the owner." Say so in the code
comment above `deriveAcl`, not just in this plan, so nobody reads the function name later and assumes more than it
delivers.

> **Verify:** unit tests — `(true, "@alice")` → `["@alice"]`; `(false, "@alice")` → `["*"]`. The doc comment above the
> function states both the `BindingDocumentService.ts` precedent and the by-ID enforcement gap, not just the return
> shape.

**1.5 `src/content/diffSize.ts`.** `shouldInline(diffBytes: number, maxBytes: number): boolean` — the cap decision
from [What gets written](../specs/2026-08-14-forgejo-code-sync-design.md#what-gets-written), isolated so the
size-threshold logic doesn't get buried inside the HTTP-fetching code written in Phase 4.

> **Verify:** unit tests — at, above, and below the boundary.

*Commit: `feat(forgejo-code-sync): config, identity, signature verification, ACL derivation and diff-size pure core`*

---

## Phase 2 — Webhook receipt and the queue

**2.1 `src/queue.ts`.** A persisted queue for commit-sync tasks, per the spec's
[Delivery reliability](../specs/2026-08-14-forgejo-code-sync-design.md#delivery-reliability-no-safety-net-from-forgejo)
section — Forgejo will never redeliver a failed webhook, so this service's own retry is the only safety net. Minimum
shape: `enqueue(task)`, `markSucceeded(id)`, `markFailed(id, error)` with backoff scheduling, and a status distinct
for "pending," "retrying," and "exhausted, needs attention" — the last must be distinguishable from an ordinary
"skipped, no linked eVault" outcome in whatever this emits to logs/metrics, per the spec's explicit requirement that
those two must never look the same from outside.

Backing store is an open implementation choice within this phase — SQLite file, a table in whatever Postgres this
service ends up with, even a durable on-disk JSON queue for a first cut — but it must survive a process restart; an
in-memory-only queue does not satisfy the spec's requirement and should not be treated as a placeholder that's "good
enough for now," since the whole point of this phase is that Forgejo gives this service no second chance.

> **Verify:** unit tests — a task that fails is retried with backoff, not dropped; one that exhausts its retry budget
> is marked exhausted, not silently removed; the queue's contents survive a simulated restart (reload from the
> backing store and confirm the pending task is still there).

**2.2 `src/webhook/push.ts`.** `POST /webhook` — capture the raw request body (`express.json({ verify: (req, res,
buf) => { req.rawBody = buf } })`, per the spec's explicit trap about re-serialized bodies breaking signature
verification), check it with `verifyForgejoSignature` from 1.3, parse the `PushPayload`, and for each commit call
`queue.enqueue(...)` with everything downstream processing will need: `pusher.username`, `repo` (owner/name),
`repo.private`, `ref`, the commit's `id`/`message`/`timestamp`/`added`/`removed`/`modified`, and the commit's own URL
(for the `diffUrl` fallback). Responds `200` once every commit in the delivery is durably queued — not once they're
processed, per the spec's architecture diagram.

> **Verify:** unit tests — a request with a valid signature and N commits enqueues N tasks and returns 200; an
> invalid signature is rejected before anything is queued; a request with 0 commits (e.g. a tag push, if the system
> webhook fires on non-branch refs too) queues nothing and still returns 200 rather than erroring.

*Commit: `feat(forgejo-code-sync): webhook receipt, raw-body signature verification and the persisted retry queue`*

---

## Phase 3 — Identity resolution and the eVault write

**3.1 `src/identity.ts`, the network half.** `resolveEname(username: string): Promise<string | null>` — `GET
{FORGEJO_API_URL}/api/v1/users/{username}` with `FORGEJO_ADMIN_TOKEN`, read `login_name` off the response, pass it
through `enameFromLoginName` from 1.2. Cache successful and null-mapping results with a long TTL; a 404 (account
deleted) evicts the cache entry rather than being retried on the usual backoff schedule, since a deleted account isn't
a transient failure.

> **Verify:** unit tests with the HTTP call stubbed — a `login_name` starting with `@` resolves to that ename; one
> that doesn't returns `null`; a second call for the same username within the TTL doesn't re-hit the stub; a 404
> evicts a previously-cached entry.

**3.2 `src/evault/client.ts`.** The certify-then-per-eName-GraphQL-client pattern, copied from
[`EVaultService.ts`](../../../platforms/calendar/api/src/services/EVaultService.ts)'s shape: `ensurePlatformToken()`
caches the Registry certification until near expiry, `getClient(eName)` returns a `GraphQLClient` with `Authorization`
and `X-ENAME` headers, `writeCommit(eName, payload, acl)` calls `createMetaEnvelope` with the `codeCommit` ontology id
minted in 0.3.

> **Verify:** unit tests with `fetch`/`GraphQLClient` stubbed — certification is requested once and reused across
> multiple `writeCommit` calls within the cache window; a new token is requested after simulated expiry; the mutation
> variables sent match `{ ontology: <codeCommit id>, payload: {...}, acl }` exactly.

**3.3 Wire the queue's drain loop.** The consumer side of `queue.ts`: for each dequeued task, resolve the eName
(3.1) — `null` marks the task done-and-skipped, not failed, and must not enter the retry path — derive the ACL from
the task's `repo.private` (1.4), fetch or cap the diff (Phase 4), and call `writeCommit` (3.2). A thrown error at any
step marks the task failed and lets the queue's backoff handle the retry.

> **Verify:** integration test (all externals stubbed) — a task for a `login_name`-having pusher on a public repo
> ends in a `createMetaEnvelope` call with `acl: ["*"]`; one on a private repo ends with the owner-only ACL; a task
> for an unlinked account is marked done without ever calling `writeCommit`; a stubbed eVault failure marks the task
> failed and leaves it in the queue for retry, not silently dropped.

*Commit: `feat(forgejo-code-sync): identity resolution, eVault client, and the queue's drain loop`*

---

## Phase 4 — Diff fetching

**Superseded — see the status note at the top of this document.** What actually shipped: `fetchDiff(task, eName):
Promise<string>`, fetching from `GET {FORGEJO_API_URL}/api/v1/repos/{repo}/git/commits/{sha}.diff` (the API router,
not the web router below — confirmed live that the web router never authenticates a PAT for a private repo), then
uploading the result to S3 via `storage/s3.ts` and returning that URL. No size cap; throws on any failure instead of
degrading to a fallback, since there's no longer a lesser fallback to degrade to.

**4.1 `src/content/diff.ts`, as originally planned.** `fetchDiff(repo, sha, token): Promise<{ diff: string } | { diffUrl: string }>` — `GET
{FORGEJO_API_URL}/{owner}/{repo}/commit/{sha}.diff` with `FORGEJO_ADMIN_TOKEN` (needs `read:repository` per the
spec's [Trust model](../specs/2026-08-14-forgejo-code-sync-design.md#trust-model)); if the response exceeds
`FORGEJO_SYNC_DIFF_MAX_BYTES` (checked via `Content-Length` where present, or a streamed byte count where it isn't)
or the request fails outright, return the `diffUrl` fallback using the commit's own GitW3 URL or `Repo.CompareURL`
from the original webhook payload — no diff field attempted in that case, per the spec.

> **Verify:** unit tests with the HTTP call stubbed — a small diff is returned inline; one over the cap returns
> `diffUrl` with no `diff` field; a stubbed network failure degrades to `diffUrl` rather than throwing out of the
> queue task (the task should still succeed and write an envelope with `diffUrl` set, not fail and retry forever on
> an oversized or permanently-erroring diff).

**4.2 Wire into the drain loop from 3.3.**

> **Verify:** the Phase 3.3 integration test extended with a real (stubbed) diff fetch — the written envelope's
> `diff`/`diffUrl` fields match the cap decision.

*Commit: `feat(forgejo-code-sync): commit diff fetching with size cap and URL fallback`*

---

## Phase 5 — Wiring and packaging

**5.1 `src/index.ts`.** Wire the webhook route, start the queue's drain loop, add `/healthz`, log the resolved
`FORGEJO_API_URL` and queue backend at startup, fail fast on a config error.

> **Verify:** `pnpm --filter forgejo-code-sync dev` starts; `curl /healthz` returns 200; starting with a missing env
> key exits non-zero naming the key.

**5.2 `docker/Dockerfile.forgejo-code-sync`**, following the `docker/Dockerfile.<name>` convention used by the
bridge's own Dockerfile.

**5.3 `services/forgejo-code-sync/README.md`** — what it is, the two contracts in one paragraph each (mirroring the
bridge's README structure), the env table, how to run it locally, and how to provision the site-admin service account
and register the system webhook (5.4 below). Link the spec rather than restating it.

**5.4 Provisioning script.** A small script (shell or `ts-node`, whichever matches how 5.4 ends up being run) that
calls `POST /api/v1/admin/hooks` on `FORGEJO_API_URL` with `FORGEJO_ADMIN_TOKEN` to register the system webhook
pointed at this service's `/webhook` endpoint, per the spec's [Deployment](../specs/2026-08-14-forgejo-code-sync-design.md#deployment)
section — the `POST /api/v1/admin/hooks` route confirmed against GitW3's own source, not by analogy. Idempotent if
practical (check for an existing hook with this service's URL before creating a second — `GET /api/v1/admin/hooks` is
paginated, so the check must page through all results, not just the first page's default limit), matching the spirit
of `docker/gitw3-register-auth-source.sh` even though the mechanism (REST API, not CLI) differs.

**GitW3-verified request shape, and a trap in it**: checked directly against
`routers/api/v1/admin/hooks.go`/`routers/api/v1/utils/hook.go` (`addHook`, `checkCreateHookOption`) —

```jsonc
// POST /api/v1/admin/hooks
{
  "type": "forgejo",              // required; "gitea" also works — anything else (e.g. "slack") changes the
                                   // payload shape and drops the signature headers this service depends on
  "config": {
    "url": "<this service's /webhook URL>",   // required, validated as a URL
    "content_type": "json",                    // required; only "json" or "form" are valid — "form" would break
                                                // the raw-body JSON signing this service's verification assumes
    "secret": "<FORGEJO_WEBHOOK_SECRET>",      // NOT required by the API — omitting it is accepted with 201
    "is_system_webhook": "true"                // undocumented in CreateHookOption's own shape — see the trap below
  },
  "events": ["push"],              // optional — omitted entirely defaults to exactly ["push"] server-side, but
                                    // pass it explicitly rather than relying on that default
  "active": true                   // required to actually fire. Defaults to false if omitted.
}
```

**The trap**: `active` defaults to `false` (`CreateHookOption.Active bool`, zero value). A request that omits it
still returns `201 Created` with a real hook ID — Site Administration → Webhooks shows it, `GET /admin/hooks` lists
it — but `IsActive: form.Active` means it silently never delivers a single push. This is a false-positive success at
exactly the boundary the [Deployment](../specs/2026-08-14-forgejo-code-sync-design.md#deployment) verification step
below checks ("the hook appears in Site Administration") — "appears" is not "active," and the current verification
wording doesn't distinguish them. A second, lower-severity version of the same class of mistake: `config.secret` is
accepted as absent (`checkCreateHookOption` only requires `url` and `content_type`) — an omitted secret means
Forgejo signs with an empty key, so `X-Forgejo-Signature` arrives empty and `verifyForgejoSignature` correctly
rejects every delivery, but from the outside this looks identical to "webhook never configured," not "webhook
misconfigured," making it slower to diagnose than the `active` trap.

**A third trap, found only by testing against a live instance — this JSON body's own comment above understated it.**
`POST /admin/hooks` creates a "default" webhook, not a "system" one, unless `config.is_system_webhook` is the
*string* `"true"` — read out of `CreateHookOption`'s free-form `config` map by
`routers/api/v1/utils/hook.go`'s `addHook`, not a documented top-level field. Reproduced directly: without it, the
create call still returns `201`, but the resulting hook (a) is invisible to `GET /admin/hooks` — that endpoint's
`GetSystemWebhooks` filters `is_system_webhook=true` at the DB layer — and (b) is only copied into repos created
*after* it's added, never applying retroactively to an existing repo. Both failure modes are silent successes,
exactly like the `active` trap, and compound with it: a hook that's both inactive and non-system passes every
naive check (`201` returned, script exits `0`) while doing nothing at all, for two independent reasons. Deleting a
stray non-system hook created this way has no API or CLI path either — `GetDefaultWebhooks` (the model function that
would list it) is only called from the web admin UI's own handler, `routers/web/admin/hooks.go`, never exposed over
`/api/v1/`.

> **Verify:** run against a local GitW3 instance with a real site-admin token — the hook appears in Site
> Administration → Webhooks **and its Active toggle is on** (not just present in the list); a manual "Test Delivery"
> from that same screen (or an actual push) results in a real `POST` hitting this service's `/webhook`, not just a
> row existing in the hooks table; running the script twice does not create a duplicate.

*Commit: `chore(forgejo-code-sync): dockerfile, service README, and system-webhook provisioning script`*

---

## Phase 6 — Local end-to-end

No new code in this phase — it's where the acceptance criteria are actually exercised, mirroring the bridge's own
Phase 5.

**6.1 Provision the site-admin service account** on a local GitW3 instance, generate its PAT with `read:user,
read:repository` scopes, run the 5.4 script to register the webhook.

**6.2 Link a real W3DS identity** to a GitW3 account via the bridge's own local flow (Dev Sandbox, per the bridge's
README), so a real `login_name` exists to resolve against.

**6.3 Push a commit** from that linked account to a public repo, then a private one.

> **Verify:** the public-repo push produces an envelope with `acl: ["*"]`; the private-repo push produces one with
> the owner-only ACL; both carry the correct `authorEName`, matching the eName the account was linked with; a diff
> under the configured cap is inlined, and lowering `FORGEJO_SYNC_DIFF_MAX_BYTES` to something tiny and repeating
> produces `diffUrl` instead.

**6.4 Push from an unlinked account** (a plain password-registered GitW3 user).

> **Verify:** no envelope is written; the queue shows the task as done-and-skipped, not failed; nothing alerts.

**6.5 Simulate a dropped delivery** — stop the eVault (or point `PUBLIC_EVAULT_SERVER_URI` at something unreachable)
before a push, then restore it.

> **Verify:** the task is retried and eventually succeeds once the eVault is reachable again, with no restart of this
> service required; if the service itself is restarted mid-retry, the task is still there afterward (queue
> persistence from 2.1).

---

## Order dependencies

```
0 ──▶ 1 ──▶ 2 ──▶ 3 ──▶ 4 ──▶ 5 ──▶ 6
                              ▲
                    deployment path (open, see spec) —
                    does not block anything above;
                    only blocks an actual staging rollout
```

Phase 1 has no dependency on a live GitW3 instance, an eVault, or an admin token — everything in it is stubbed or
pure, same discipline as the bridge's own plan. Phase 2's queue exists before Phase 3's network calls specifically so
that Phase 3 can be built and tested against a queue that already has the right failure-handling contract, rather than
retrofitting persistence onto code that was written assuming every call succeeds.

## Out of scope

Re-scanning already-synced envelopes when a repo's visibility changes after the fact (the spec's named, accepted ACL
limitation). A UI or query surface for a person to browse their own synced commits — this plan only covers the write
path. Handling merge commits or squash-merges any differently from an ordinary commit — the webhook payload doesn't
distinguish them, and neither does this design.
