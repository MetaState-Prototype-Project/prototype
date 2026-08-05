# Implementation plan — W3DS → OIDC bridge

**Spec:** [2026-08-05-w3ds-oidc-bridge-design.md](../specs/2026-08-05-w3ds-oidc-bridge-design.md)
**Issue:** MetaState #1097

Rationale lives in the spec; this document is the order of work and how each step is proved. Every task states its
verification. A task is not done until its verification passes.

Conventions taken from the repo: `vitest run` as the `test` script (as in `packages/w3ds-gateway`), Biome for format and
lint, `tsc --noEmit` as `check-types`, config read from the root `.env`.

Phases 1 and 2 are fully testable without Forgejo or a wallet. Do not skip ahead — the pure core is where the traps are,
and it is the only part that can be tested exhaustively.

---

## Phase 0 — Scaffolding

**0.1 Create the package.** `services/w3ds-oidc-bridge/` with `package.json` (name `w3ds-oidc-bridge`, `type: module`),
`tsconfig.json`, `tsconfig.build.json`, `README.md`. Scripts: `dev` (nodemon + ts-node), `build`, `start`, `test`,
`test:watch`, `check-types`. Dependencies: `express`, `jose`, `qrcode`, `uuid`, `dotenv`,
`@metastate-foundation/auth: workspace:*`. Dev: `vitest`, `typescript`, `@types/*`, `nodemon`, `ts-node`.

It is picked up by `services/*` in `pnpm-workspace.yaml` — no workspace change needed.

> **Verify:** `pnpm install` resolves, `pnpm --filter w3ds-oidc-bridge check-types` passes on an empty `src/index.ts`.

**0.2 Add env keys to `.env.example`** (all of the spec's Deployment table). Do not touch `.env`.

> **Verify:** every key in the spec's table appears in `.env.example`.

*Commit: `chore(w3ds-oidc-bridge): scaffold the service package`*

---

## Phase 1 — The pure core

No HTTP in this phase. Everything here is a function.

**1.1 `src/config.ts`.** Parse and validate env with a `required()` helper that throws at startup, mirroring
[awareness-service](../../../services/awareness-service/api/src/config.ts). Load the root `.env` by relative path.

Include the TLS guard: throw unless `W3DS_OIDC_PUBLIC_URL` starts with `https://`, or `W3DS_OIDC_ALLOW_INSECURE` is
exactly `"true"`. Normalise `W3DS_OIDC_PUBLIC_URL` by stripping any trailing slash — the issuer is compared byte for
byte by goth, and a stray slash is a silent, total failure.

> **Verify:** unit tests — missing key throws naming that key; `http://` throws; `http://` with the escape hatch is
> accepted; trailing slash is stripped.

**1.2 `src/claims.ts`.** The sanitiser and the claim builder. This is the highest-risk file in the project; write the
tests first.

Implement the pipeline exactly as specified: strip `@`, replace characters outside `[0-9A-Za-z_.-]` with a hyphen,
collapse runs of `[-._]`, strip leading and trailing `[-._]`, truncate to 40, re-strip the tail, and fall back to the
**empty string** — never an absent key — when the result is empty, reserved, or matches a reserved pattern.

Copy `reservedUsernames` and the `*.keys` / `*.gpg` / `*.rss` / `*.atom` / `*.png` patterns from GitW3
`models/user/user.go:639` into a named constant with a comment pointing at that source, so a future upstream change is
traceable.

Extend the reserved list with `W3DS_EXTRA_RESERVED_USERNAMES` from config, parsed case-insensitively. This is what
makes the fallback path testable against a real wallet in phase 5 — enames are assigned, not chosen.

Email: local part from the ename minus the leading `@`, characters outside `[0-9A-Za-z._-]` replaced by a hyphen,
domain from config.

> **Verify:** table-driven tests covering at minimum — the four rows of the spec's example table; `@Alice` and `@alice`
> both yielding `alice`-cased names that collide on lowercase; an ename of 60 characters truncating to 40 with no
> trailing separator; `@ali..ce` collapsing; `@api`, `@admin`, `@.well-known` hitting the reserved list; `@foo.keys`
> hitting the reserved *pattern*; a name that is entirely punctuation falling back to empty.
>
> **And the regression guard:** for every fallback case, assert `"nickname" in claims` and
> `"preferred_username" in claims` are `true` and the values are `""`. An assertion on falsiness alone would pass on an
> absent key, which is the crash case (spec, "The fallback must be an empty string").

**1.3 `src/store.ts`.** Two TTL maps with a sweeper. Sessions: 5 minutes, holding `client_id`, `redirect_uri`, `state`,
`nonce`, `code_challenge`, and later `ename`. Codes: 60 seconds, single use — reading a code must delete it in the same
operation so a concurrent second exchange cannot win a race.

> **Verify:** unit tests — an entry past its TTL is gone; consuming a code twice returns the value then `undefined`;
> the sweeper does not evict a live entry.

**1.4 `src/keys.ts`.** Load the ES256 private key from config, derive the public JWK, expose the JWKS document with the
configured `kid`, and expose sign/verify helpers over `jose`.

> **Verify:** unit test — a token signed and then verified round-trips; the JWKS `kid` matches config; the JWK contains
> no private material (`d` absent).

*Commit: `feat(w3ds-oidc-bridge): config, claims, store and signing key`*

---

## Phase 2 — The OIDC surface

**2.1 `src/clients.ts`.** Single-client lookup by `client_id`, returning the registered `redirect_uri` and secret. One
function, so a second client is a data change rather than a refactor.

**2.2 `src/oidc/discovery.ts`.** `GET /.well-known/openid-configuration`. Advertise `issuer`, `authorization_endpoint`,
`token_endpoint`, `userinfo_endpoint`, `jwks_uri`, `scopes_supported: ["openid","profile","email"]`,
`response_types_supported: ["code"]`, `id_token_signing_alg_values_supported: ["ES256"]`,
`code_challenge_methods_supported: ["S256"]`.

> **Verify:** test asserts `issuer` equals `W3DS_OIDC_PUBLIC_URL` exactly, and that every advertised URL is absolute and
> shares that origin.

**2.3 `src/oidc/token.ts` before `authorize`.** Build the ID token first so its shape is settled: `iss`, `aud`, `sub`,
`exp`, `iat`, `nonce` when present, plus `nickname`, `preferred_username`, `email`, `email_verified: false`. The access
token is a separate JWT with the same `sub` and a 5-minute TTL.

`POST /token` checks, in order: `grant_type=authorization_code`; client authentication via `client_secret` compared with
`crypto.timingSafeEqual`; the code exists and is consumed atomically; `redirect_uri` matches the one recorded at
`/authorize` exactly; `code_verifier` hashes with SHA-256/base64url to the stored `code_challenge`.

> **Verify:** unit tests — `exp` is present and numeric; `iss` is byte-identical to the discovery document's; `aud`
> equals `client_id`; a code refused on second use; a `code_verifier` off by one character rejected; a `redirect_uri`
> off by one character rejected; a wrong secret rejected. Each rejection returns the OAuth2 error code, not a 500.

**2.4 `src/oidc/authorize.ts`.** Validate `client_id` and `redirect_uri` first, and only after both are valid may an
error be returned by redirect. Anything wrong with those two renders an error page and never redirects. Then require
`response_type=code`, `code_challenge`, and `code_challenge_method=S256` — reject `plain`.

On success: create the session, build the offer with `buildAuthOffer({ baseUrl, platform: "gitw3", callbackPath:
"/w3ds/callback" })` from `@metastate-foundation/auth`, render the QR as a `qrcode` data URI, and serve the page with
one inline `EventSource` script.

> **Verify:** tests — unknown `client_id` renders a page and sends no `Location` header; unregistered `redirect_uri`
> likewise; missing `code_challenge` redirects with `error=invalid_request`; `code_challenge_method=plain` rejected; a
> valid request returns HTML containing a `data:image` QR and the session id.

**2.5 `src/oidc/userinfo.ts` and the JWKS route.** `/userinfo` verifies the bearer JWT with `jose` and returns the same
claims as the ID token. Its `sub` must be identical to the ID token's — goth rejects the response otherwise.

> **Verify:** test asserts `userinfo.sub === idToken.sub` for the same exchange; a missing or expired bearer returns
> 401.

*Commit: `feat(w3ds-oidc-bridge): OIDC discovery, authorize, token, userinfo and JWKS`*

---

## Phase 3 — The W3DS surface

**3.1 `src/w3ds/events.ts`.** `GET /w3ds/events/:session` — SSE, `Content-Type: text/event-stream`, no buffering, a
heartbeat every 30 seconds to match the platform convention, and cleanup on client disconnect. Two message kinds:
`redirect` with the callback URL, and `error` with a human-readable message.

> **Verify:** test — a subscriber receives a `redirect` event when the session is completed programmatically; the
> connection is removed from the registry on close.

**3.2 `src/w3ds/callback.ts`.** `POST /w3ds/callback`. Read the ename from `ename`, falling back to `w3id`. Validate the
required fields, then the `appVersion` gate against `W3DS_MIN_WALLET_VERSION`, then look up the session, then call
`verifyLoginSignature` from `@metastate-foundation/auth` with the session id as the payload.

On success, mint the authorisation code and push `redirect` into the SSE stream. On **every** failure, push `error` into
the SSE stream as well as returning the HTTP status — the browser is waiting in front of a QR code and has no other way
to learn what happened.

Keep the `appVersion` check in one small function; the spec notes it is temporary and will be removed after the wallet
rollout.

> **Verify:** tests with `verifySignature` stubbed — `ename` and `w3id` both accepted; `appVersion: "0.3.9"` rejected
> *and* an error pushed to SSE; unknown session rejected; expired session rejected; invalid signature rejected; a valid
> call mints exactly one code and pushes `redirect`.

**3.3 `src/index.ts`.** Wire the routes, add a `/healthz`, log the resolved issuer at startup, and fail fast on a config
error rather than starting a half-working server.

> **Verify:** `pnpm --filter w3ds-oidc-bridge dev` starts; `curl /.well-known/openid-configuration` returns the document;
> `curl /healthz` returns 200; starting with a missing env key exits non-zero with a message naming the key.

*Commit: `feat(w3ds-oidc-bridge): W3DS callback and SSE session stream`*

---

## Phase 4 — Packaging

**4.1 `docker/Dockerfile.w3ds-oidc-bridge`,** following the pattern of the existing `docker/Dockerfile.*` files.

**4.2 `services/w3ds-oidc-bridge/README.md`** — what it is, the two contracts in one paragraph each, the env table, how
to run it locally, and how to test with the Dev Sandbox. Link the spec rather than restating it.

**4.3 The W3DS button icon.** *Done.* Served by the bridge itself at `/icon.svg`, so the browser can always reach it —
it is about to be sent to the same origin for `/authorize` — and the mark cannot fall out of step with the service.
Inlined as a string in `src/icon.ts` rather than kept in `assets/`, because the build is `tsc` alone and a non-TS file
would not reach `dist/`.

A shield with a key, the same vocabulary as the Nextcloud W3DS login plugin so the button is recognisable to anyone who
has seen that one, restyled to the MetaState purple and the house convention: 162 viewBox, 32 radius, 9 stroke, white
on `#8968FF`. Checked at its real 28px display size, not only large.

> **Verify:** the image builds; the container starts with env supplied and serves the discovery document; the icon URL
> returns an image over HTTPS from a host GitW3 can reach.

**4.4 Resolve the deployment path — blocking for phase 6.** The repository contains **no service deployment manifest**.
`docker-compose.databases.yml` brings up local databases only, there is no compose file that runs any platform or
service, and no workflow in `.github/workflows/` deploys anything. So how services reach
`*.w3ds.metastate.foundation` is out of band and not knowable from this repo.

This must be settled with whoever owns the staging environment before phase 6 starts, and the answer recorded here.

`docker-compose.gitw3.yml` is a **candidate**, written to make that conversation concrete: something to accept, adapt
or reject rather than a list of questions. Its header says as much, so it cannot be mistaken for the house convention.
It brings up both services with the ordering constraint enforced, and registers the authentication source through
`docker/gitw3-register-auth-source.sh` — Forgejo keeps sources in its database, so without that step a fresh instance
needs someone to click through Site Administration before anyone can log in.

Both were verified against the running local instance: the compose file interpolates and validates, and the script's
create, update and reject branches were each exercised, leaving exactly one source behind.

What it cannot answer, and what the meeting must:

- **Who runs it, and where.** A host with Docker? An orchestrator? The answer decides whether this file is the artifact
  or just its documentation.
- **Where the images come from.** GitW3 publishes `ghcr.io/<owner>/gitw3` on `gitw3-v*` tags; the owner changes with the
  repository transfer, and org packages default to private. Nothing publishes a bridge image at all — the compose file
  builds it locally, which is a gap, not a design.
- **Which Registry, and which wallet build.** `PUBLIC_REGISTRY_URL` must name the same Registry the testers' wallets
  were provisioned against, or every signature fails verification. This decides whether criterion 5 is testable.
- **Where the two secrets live.** `W3DS_OIDC_CLIENT_SECRET` and `W3DS_OIDC_SIGNING_KEY`. Forgejo supports a `__FILE`
  suffix on its own settings; the bridge reads only environment variables, so a file-backed secret store needs a small
  addition on our side.
- **How the bridge's public hostname resolves from inside GitW3's container.** The discovery document publishes absolute
  URLs, so the back channel goes out through the public name — there is no internal shortcut. `extra_hosts` is the
  escape hatch where the network cannot hairpin.
- **Who terminates TLS.** Non-negotiable for the bridge: goth never verifies the ID token signature.

*Commit: `chore(w3ds-oidc-bridge): dockerfile, service README and button icon`*

---

## Phase 5 — GitW3 wiring and local end-to-end

No code in this phase — it is configuration, and it is where the acceptance criteria are actually met.

**5.1 Generate the key pair** (ES256) and a `client_secret`. Keep them out of the repo. Record the `kid` chosen.

**5.2 Configure GitW3.** In `app.ini`:

```ini
[oauth2_client]
ENABLE_AUTO_REGISTRATION = true
ACCOUNT_LINKING = login
USERNAME = nickname
REGISTER_EMAIL_CONFIRM = false
```

`REGISTER_EMAIL_CONFIRM` must be set in `[oauth2_client]`, not `[service]`, or it inherits the `[service]` value again
(`modules/setting/oauth2.go:69`) and every W3DS account is created inactive with its activation mail sent to an address
that never delivers. Also decide `REGISTER_MANUAL_CONFIRM` deliberately: it has the same effect, less fatally.

Confirm `ALLOW_ONLY_INTERNAL_REGISTRATION` is `false`. Then add an authentication source: OAuth2 → OpenID Connect,
auto-discovery URL pointing at the bridge, client id and secret, and the `IconURL` field pointing at the icon from 4.3.
This satisfies acceptance criterion 3 with no patch to Forgejo.

**5.3 Walk the flow with the Dev Sandbox.** Provision an eVault, open GitW3's login page, click the W3DS button, copy
the `w3ds://auth` URI from the QR page, paste it into the sandbox, and click Perform.

> **Verify:** a GitW3 account is created with the expected username and synthetic email; the account is **active** —
> not awaiting an activation mail that will never arrive; the `sub` stored in `external_login_user.external_id` is the
> full ename; signing in a second time reuses the same account rather than creating a second.

**5.4 Walk the two failure paths deliberately.**

The reserved-name path cannot be reached by choosing an ename: the Dev Sandbox calls `provision()` with
`namespace: crypto.randomUUID()` and the `w3id` comes back from the Provisioner
(`infrastructure/dev-sandbox/src/routes/+page.svelte:482`). Provisioning `@admin` is not possible.

Reach it the other way instead: provision a normal identity, then add its sanitised username to
`W3DS_EXTRA_RESERVED_USERNAMES`, restart the bridge, and sign in. The claim goes out empty and the linking page must
render rather than panic. Remove the entry afterwards.

Second path: an outdated `appVersion` must surface as a readable error on the QR page rather than an indefinite spinner.

> **Verify:** both render; neither produces a 500 or a panic in the GitW3 log.

**5.5 Repeat 5.3 and 5.4 under `USERNAME = preferred_username`.** This is the configuration where an absent claim
panics; it must behave identically. Restore `nickname` afterwards.

> **Verify:** identical outcomes under both settings.

---

## Phase 6 — Staging

Blocked on 4.4 until the deployment path is known.

**6.1 Deploy** the bridge behind TLS, with `W3DS_OIDC_ALLOW_INSECURE` unset.

**6.2 Run the staging checklist:**

- the discovery URL is `https://` and `W3DS_OIDC_ALLOW_INSECURE` is unset;
- `[oauth2_client] ACCOUNT_LINKING` is `login`, not `auto`;
- `[oauth2_client] REGISTER_EMAIL_CONFIRM` is `false` — set there, not inherited from `[service]`;
- a fresh ename creates an **active** account, and signing in again reuses it rather than creating a second;
- a reserved name reaches the linking page and renders it.

The email-confirmation check is the one most likely to be missed, because the default is `false` on both sides locally.
It only bites on an instance with the setting turned on, and the symptom — sign-in succeeds, the account exists, login
is refused — does not point at its cause.

**6.3 End to end with a real eID Wallet** — acceptance criterion 5.

> **Verify:** every item above passes, recorded in the issue.

---

## Order dependencies

```
0 ──▶ 1 ──▶ 2 ──▶ 3 ──▶ 4 ──▶ 5 ──▶ 6
       │      │           │           ▲
       └──────┘           └── 4.4 ────┘
   neither Forgejo         deployment path
   nor a wallet            must be settled first
```

4.4 is the only unknown in this plan that cannot be resolved from the repository. Raise it early — it does not block
phases 0 through 5, but it does gate the acceptance criterion.

Phase 2.3 deliberately precedes 2.4: the token shape determines what `/authorize` has to capture, and building them the
other way round tends to discover a missing field late.

## Out of scope

Correcting `w3id` → `ename` in the protocol documentation, and removing the `appVersion` gate once the wallet rollout
completes. Both are tracked as open items in the spec.
