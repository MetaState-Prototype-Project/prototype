# W3DS → OIDC bridge for GitW3

**Date:** 2026-08-05
**Issue:** MetaState #1097 — Make GitW3 compatible with W3DS login
**Status:** sections approved in discussion; document awaiting review

Paths given without a link refer to the GitW3 fork (`ensombl/gitw3`), a separate repository.

## Problem

GitW3 is a fork of Forgejo (MetaState #1096). Forgejo has no plugin API, and the fork's governing constraint is a patch
surface of zero: every line that diverges from upstream is a merge conflict on every security release.

Forgejo does support external authentication out of the box, via OAuth2 authentication sources. So the way to add W3DS
login without touching Forgejo's source is to speak a protocol Forgejo already understands. That protocol is OpenID
Connect.

The bridge is an OpenID Provider on one side and a W3DS platform on the other. Forgejo believes it is talking to an
ordinary OIDC provider. The wallet believes it is talking to an ordinary W3DS platform. Neither is modified.

This works because OIDC does not specify *how* a provider authenticates the user. Password, passkey, or a QR code signed
by an eID wallet — the provider decides, and the client only sees the resulting ID token.

## Approach

Three options were considered.

**A hand-rolled minimal OIDC subset** (chosen). Implement only the endpoints Forgejo actually calls, using `jose` for
token signing. Roughly 400 lines. The alternative implementations are general-purpose OIDC providers, and every feature
they carry that we do not need — dynamic client registration, consent screens, refresh token rotation, multi-tenancy —
is surface we would have to configure correctly and keep secure.

**A full OIDC provider library** (`oidc-provider`). Rejected: the configuration surface is larger than the
implementation we are avoiding, and the failure modes are harder to reason about.

**A native Forgejo patch.** Rejected: it violates the zero-patch-surface constraint that governs the fork.

### On the Nextcloud prior art

The issue points at `ensombl/nextcloud-w3ds-login` as prior art. It solves the same problem — W3DS login for a
third-party app with local accounts — but it is **not an OIDC bridge**: it is a native Nextcloud plugin implementing
`IAlternativeLogin`. Nextcloud has a plugin API; Forgejo does not. So there is no code to reuse.

Its structure does validate ours by independent convergence: 5-minute session TTL, 1-minute handoff token, a persistent
W3ID ↔ local user mapping table, auto-provisioning on first login, and account linking that reuses the same session
machinery. We land on the same numbers. One difference in our favour: the mapping table is free for us. Forgejo's
`external_login_user` already stores exactly that relationship for any OAuth2 source.

## The two contracts

The bridge is wedged between two protocols it does not get to choose. Everything below is imposed; the rest of this
document is our own design.

### Wallet side

Twelve platform controllers in this repository emit this URI. Six were checked against the contract below — blabsy,
pictique, evoting, calendar, file-manager, awareness-service — and they agree. It was verified against those
controllers, not against the documentation; see [Documentation drift](#documentation-drift).

```
offer      w3ds://auth?redirect=<POST url>&session=<uuid>&platform=gitw3
POST body  { ename, session, signature, appVersion }
signed     the signed payload IS the session id, nothing else
verify     verifySignature({ eName, signature, payload: session, registryBaseUrl })
gate       appVersion >= 0.4.0
```

The bridge builds its offer with `buildAuthOffer()` from `@metastate-foundation/auth`
([packages/auth/src/auth-offer.ts](../../../packages/auth/src/auth-offer.ts)) rather than re-implementing the URI
format. The package currently has no consumers; the bridge will be the first. Using it means the bridge cannot drift
from the canonical format.

The URI is built by raw interpolation, without percent-encoding the `redirect` parameter. This is what `buildAuthOffer`
does and what five of the six platform controllers do. `platforms/calendar` is the outlier — it applies
`encodeURIComponent` to both `redirect` and `platform`
([AuthController.ts:33](../../../platforms/calendar/api/src/controllers/AuthController.ts)). The documentation says to
encode; no reference implementation does. We follow the majority.

The callback path is ours to choose — it travels inside the `redirect` parameter. We use `/w3ds/callback`.

#### Documentation drift

[docs/docs/W3DS Protocol/Authentication.md](../../docs/W3DS%20Protocol/Authentication.md) documents the POST body field
as `w3id`. Every platform controller reads `ename` and rejects with `"ename is required"`. Only
[awareness-service](../../../services/awareness-service/api/src/controllers/AuthController.ts) accepts both.

**The bridge accepts both**, preferring `ename`, matching awareness-service. Fixing the documentation is out of scope
for this issue.

### Forgejo side

Forgejo authenticates via `markbates/goth`'s `openidConnect` provider. Every constraint below was read from that
provider's source, not inferred.

| Claim | Constraint | Consequence if violated |
|---|---|---|
| `exp` | present, numeric | **panics the Forgejo handler** — unchecked type assertion, [openidConnect.go:341](https://github.com/markbates/goth/blob/master/providers/openidConnect/openidConnect.go#L341) |
| `iss` | byte-identical to the discovery document's `issuer` | error |
| `aud` | equals `client_id`, or an array containing it | error |
| `sub` | becomes `UserID`; must match `/userinfo`'s `sub` if that endpoint is served | error |
| `email` | non-empty | falls through to the account-linking page, `routers/web/auth/oauth.go:1115` |

Three properties of goth that shape the design:

**PKCE is available.** `generateCodeChallenge` only emits a challenge for a whitelist of providers, and
`*openidConnect.Provider` is on it (`routers/web/auth/oauth.go:1513`). Forgejo will send `code_challenge` with
`S256`, so the bridge can require it rather than merely accept it.

**`/userinfo` is optional.** goth skips the request entirely when the discovery document omits `userinfo_endpoint`
(`openidConnect.go:363`). We serve it anyway for conformance — it costs about fifteen lines — but this is a choice, not
a constraint. Serving it does impose one: its `sub` must exactly match the ID token's, or goth rejects the response
(`openidConnect.go:384`).

**goth does not verify the ID token signature.** `decodeJWT` splits the token on `.`, base64-decodes the payload, and
JSON-parses it; the signature segment is never examined (`openidConnect.go:510`). There is no JWKS fetch anywhere in the
provider, and `jwks_uri` is not even a field on the struct goth deserialises the discovery document into. See
[Trust model](#trust-model) — this is the single most important fact in this document.

## Architecture

A single Express + TypeScript process, seven endpoints, two façades. Dependencies: `express`, `jose` for token signing
and verification, `qrcode` for server-side QR rendering, `uuid`, and `@metastate-foundation/auth` as a workspace
dependency (which brings in `signature-validator`).

| Forgejo-facing | Purpose |
|---|---|
| `GET /.well-known/openid-configuration` | discovery |
| `GET /authorize` | validate request, open a session, serve the QR page |
| `POST /token` | exchange code + `code_verifier` for an ID token |
| `GET /userinfo` | served for conformance; goth would skip it if absent |
| `GET /jwks` | public key — decorative, see [Trust model](#trust-model) |

| W3DS-facing | Purpose |
|---|---|
| `POST /w3ds/callback` | wallet posts ename + signature |
| `GET /w3ds/events/:session` | SSE; tells the browser when to continue |

### Flow

```
 browser            bridge                     wallet         registry
     │                 │                          │               │
  click "W3DS"         │                          │               │
     ├─ GET /authorize ▶                          │               │
     │   client_id, redirect_uri, state,          │               │
     │   nonce, code_challenge (S256)             │               │
     │                 ├ validate, create session │               │
     ◀─ QR page ───────┤   TTL 5 min              │               │
     ├─ SSE /events ──▶│                          │               │
     │                 │                          │               │
     │         scan ─────────────────────────────▶│               │
     │                 ◀── POST /w3ds/callback ───┤               │
     │                 │    ename, session,       │               │
     │                 │    signature, appVersion │               │
     │                 ├─ verifySignature ────────────────────────▶
     │                 ◀──────────────── public key ──────────────┤
     │                 ├ mint code, TTL 60 s, single use          │
     ◀─ SSE: redirect ─┤                          │               │
     │                 │                          │               │
     ├─────────────▶ Forgejo /callback?code&state │               │
     │               Forgejo ─ POST /token ──────▶│               │
     │                        ◀── id_token ───────┤               │
```

### Modules

Each is independently testable and has one job.

```
config.ts      env parsing; throws at startup on anything missing
store.ts       two TTL maps — sessions, authorisation codes
keys.ts        signing key, JWKS document
claims.ts      ename → { sub, nickname, preferred_username, email }
oidc/          discovery · authorize · token · userinfo
w3ds/          callback (signature verification) · events (SSE)
```

The session map holds what `/authorize` captured — `client_id`, `redirect_uri`, `state`, `nonce`, `code_challenge` —
and gains an `ename` once the wallet callback verifies. The code map holds a single-use authorisation code bound to
that same tuple. Nothing else is stored; the access token is a JWT, so it needs no third map.

`claims.ts` is isolated because it holds every fragile rule in the system. It is a pure function with no dependencies,
so it can be tested exhaustively for nothing.

The QR page rendered by `/authorize` is server-side HTML with one inline script: an `EventSource` on
`/w3ds/events/:session` that navigates to the callback URL when the stream says so, and displays the error otherwise.
The QR image itself is generated by `qrcode` as a data URI, so the page loads nothing external.

### Client registry

One client: GitW3. Lookup is isolated in a single function so that adding a second is a few lines rather than a
refactor. No dynamic registration.

### Scopes

The discovery document advertises `openid`, `profile` and `email`. goth appends `openid` regardless
(`openidConnect.go:446`), and all three map to claims the bridge already emits, so the administrator can set
`OPENID_CONNECT_SCOPES` to any subset without breaking the flow. Unknown scopes are ignored rather than rejected.

## Claims

### The `@` trap

Forgejo's `NormalizeUserName` removes apostrophes and replaces whitespace, `~` and `+` with hyphens
(`models/user/user.go:630`). It does **not** strip `@`, and a username must start with `[0-9a-zA-Z]`.

Worse, if an administrator sets `USERNAME = preferred_username`, Forgejo splits the claim on `@` and keeps the part
*before* it (`routers/web/auth/auth.go:405`). An ename begins with `@`, so `@alice` yields the empty string.

No Forgejo code path saves us. The bridge sanitises the name itself, and emits the same value in both `nickname` and
`preferred_username` so the result is identical under either setting.

### Sanitisation

Derived from the real rules: `^[\da-zA-Z][-.\w]*$` (dots permitted — `ALLOW_DOTS_IN_USERNAMES` defaults to true,
`modules/setting/service.go:238`), the negative pattern `[-._]{2,}|[-._]$`, and the `reservedUsernames` list plus the
`*.keys`, `*.gpg`, `*.rss`, `*.atom`, `*.png` patterns (`models/user/user.go:639`).

The 40-character cap comes from `RegisterForm`, which the linking page binds (`routers/web/web.go:696`,
`services/forms/user_form.go:94`). The auto-registration path does not enforce it — it builds the user directly
(`routers/web/auth/oauth.go:1130`). We truncate on both so the two paths cannot disagree about whether a name is
acceptable.

```
@alice.w3id
  → drop the @ and replace any character outside [0-9A-Za-z_.-] with a hyphen
  → collapse runs of [-._] to a single hyphen
  → strip leading and trailing [-._]
  → truncate to 40, then re-strip the tail
  → if empty, or reserved, or matching a reserved pattern → emit the empty string
```

Case is preserved. Forgejo stores the name as given and compares on `LowerName`, so lowercasing would gain nothing and
lose legibility.

`W3DS_EXTRA_RESERVED_USERNAMES` extends the reserved list. An instance may have names of its own that must not be
claimed — an organisation that already exists, a route added by a future upstream release. It also makes the fallback
path testable end to end: enames are assigned by the Provisioner, not chosen, so the only way to exercise a reserved
name against a real wallet is to reserve a name that was actually issued.

| ename | `sub` | `nickname` / `preferred_username` | `email` |
|---|---|---|---|
| `@alice` | `@alice` | `alice` | `alice@w3ds.invalid` |
| `@user-a.w3id` | `@user-a.w3id` | `user-a.w3id` | `user-a.w3id@w3ds.invalid` |
| `@_bob` | `@_bob` | `bob` | `_bob@w3ds.invalid` |
| `@admin` | `@admin` | `""` → linking page | `admin@w3ds.invalid` |

`sub` keeps the full ename. It is the identity — it lands in `external_login_user.external_id` and must never be
ambiguous. The username is presentation only.

### The fallback must be an empty string, never an absent claim

When the sanitiser produces nothing usable, the bridge hands the problem to Forgejo: an absent or empty `nickname`
routes to `showLinkingLogin` (`routers/web/auth/oauth.go:1118`), the page where the person picks their own username or
links an existing account. Delegating to upstream machinery keeps the bridge stateless and the experience native.

**But the claim must be present and empty, not omitted.** Omitting it panics Forgejo on that very page:

1. auto-registration correctly guards the nil — `RawData["preferred_username"] == nil ||
   RawData["preferred_username"].(string) == ""` short-circuits (`routers/web/auth/oauth.go:1120`) — so
   `missingFields` fires and the user is sent to the linking page;
2. the linking page calls `getUserName` unconditionally (`routers/web/auth/linkaccount.go:53`);
3. `getUserName` does `RawData["preferred_username"].(string)` with no guard (`routers/web/auth/auth.go:405`).

Absent key → nil → unchecked type assertion → the handler panics. This only bites under `USERNAME =
preferred_username`, which is exactly the configuration the "identical under either setting" property is supposed to
cover.

An empty string satisfies every step: the nil guard passes, the assertion succeeds, `missingFields` still fires, and
`NormalizeUserName("")` returns `"", nil`. Under `nickname` the behaviour is unchanged, because goth's `getClaimValue`
skips values of zero length and falls through to `""` anyway
([openidConnect.go:481](https://github.com/markbates/goth/blob/master/providers/openidConnect/openidConnect.go#L481)).

OIDC says a claim with no value SHOULD be omitted rather than sent empty. We deviate knowingly: the only consumer is
GitW3, and for GitW3 omission is a crash. **Do not "clean this up" by dropping empty claims from the ID token.**

### Synthetic email

W3DS provides no email address, and Forgejo requires a non-empty one. The bridge builds the local part from the ename
with the leading `@` removed and any character outside `[0-9A-Za-z._-]` replaced by a hyphen, on a configurable domain.

This is a *different* derivation from the username, deliberately: the username is squeezed through Forgejo's naming
rules, whereas the address only has to parse and be unique. `@_bob` gives the username `bob` but the address
`_bob@w3ds.invalid`. Staying closer to the ename means the email is never itself the cause of a false conflict between
two distinct identities — any collision that does occur is a username collision, handled below.

Forgejo validates the address with `mail.ParseAddress` and then against the domain allow and block lists, with no DNS
lookup (`modules/validation/email.go:73`). Both lists are empty by default, so `w3ds.invalid` passes. An instance that
sets `EMAIL_DOMAIN_ALLOWLIST` must include the synthetic domain.

The default is `w3ds.invalid`: an RFC 2606 reserved TLD, guaranteed never to resolve, so mail cannot leak to a domain
someone might register. **These addresses never deliver.** Forgejo notifications to a W3DS account go nowhere. That is
inherent to W3DS not carrying email, not a defect. The escape hatch is that users can set a real address in their
Forgejo settings afterwards.

In staging the domain may be pointed at a real domain with a null MX (RFC 7505) so that bounces are clean rejections
rather than DNS failures piling up in the mail queue.

## Trust model

**goth does not verify the ID token signature.** Two consequences, both of which must be stated rather than assumed:

`/jwks` is decorative. Nothing in Forgejo will fetch it. We serve it for conformance.

**The transport between Forgejo and the bridge carries the entire security of the flow.** The ID token is trustworthy
because it arrives over the back channel, on a TLS connection, in response to a request authenticated with
`client_secret`. OIDC §3.1.3.7 explicitly permits skipping signature validation under exactly these conditions — but it
means TLS is the mechanism here, not defence in depth. On a shared Docker network without TLS, anyone able to intercept
that connection can forge an identity. This is a deployment requirement, not an infrastructure detail.

### Per-step protections

| Step | Protection | Rationale |
|---|---|---|
| `/authorize` | PKCE S256 **mandatory**, `plain` rejected | Forgejo sends it; verified |
| | `redirect_uri` compared exactly | no prefix matching |
| session ↔ wallet | uuid v4, 122 bits of CSPRNG | this is the signed value; it must be unpredictable |
| | single use, 5-minute TTL | prevents replay |
| identity | `verifySignature` against the Registry | **the actual trust anchor** |
| | `appVersion >= 0.4.0` | failure pushed into the SSE stream |
| code → token | single use, 60-second TTL | bound to client, `redirect_uri` and `code_challenge` |
| `/token` | `client_secret`, constant-time comparison | |
| ID token | ES256, stable `kid` from day one | consistent with P-256 throughout W3DS; `kid` makes rotation possible later without breakage |

`state` is echoed verbatim — Forgejo generates and checks it itself. `nonce` is propagated into the ID token when
present; goth does not validate it, so this is defence in depth for any future client.

### Access token

Because `/userinfo` is served, goth will call it with a bearer token. Rather than a third in-memory map, the access
token is itself a JWT signed with the same key, 5-minute TTL, carrying the same `sub` as the ID token — `/userinfo`
verifies it with `jose`, statelessly.

### Account linking must stay on `login`

Two distinct enames can sanitise to the same username; `@Alice` and `@alice` suffice, since Forgejo compares on
`LowerName`.

With `ACCOUNT_LINKING = login` — the default (`modules/setting/oauth2.go:78`) — the second arrival reaches the linking
page and must prove they own the existing account. Safe.

With `ACCOUNT_LINKING = auto`, Forgejo looks the account up by name, links it, and signs the person straight in
(`routers/web/auth/auth.go:573-588`). **That is an account takeover.** `auto` is prohibited, and the staging checklist
verifies it.

### Error responses

An error on `/authorize` is returned to the `redirect_uri` only once that `redirect_uri` has been validated. Unknown
client or unregistered URI renders an error page and never redirects — otherwise the bridge becomes an open redirector.

Every failure after the QR is scanned — outdated wallet, invalid signature, expired session — goes into the SSE stream.
The browser is waiting in front of a QR code and has no other way to learn that something went wrong.

### Out of scope, deliberately

No refresh tokens, no consent screen, no `end_session_endpoint`, no dynamic client registration. A single trusted client
and short sessions. Each of these would be code to write, test and maintain for a need that does not exist.

## Deployment

### Shape

`services/w3ds-oidc-bridge/`, a workspace member, flat rather than with an `api/` subdirectory — awareness-service has
one because it also ships a Svelte portal; this is a single process. `docker/Dockerfile.w3ds-oidc-bridge` follows the
`docker/Dockerfile.<name>` convention. Configuration is read from the root `.env` through a `required()` helper that
throws at startup, matching [awareness-service's config](../../../services/awareness-service/api/src/config.ts).

| Variable | Default | Note |
|---|---|---|
| `W3DS_OIDC_PUBLIC_URL` | — | the `issuer`; goth compares byte for byte |
| `W3DS_OIDC_PORT` | `4200` | |
| `W3DS_OIDC_CLIENT_ID` | — | |
| `W3DS_OIDC_CLIENT_SECRET` | — | |
| `W3DS_OIDC_REDIRECT_URI` | — | GitW3's callback; compared exactly |
| `W3DS_OIDC_SIGNING_KEY` | — | ES256 private key, never committed |
| `W3DS_OIDC_KEY_ID` | — | stable `kid` |
| `W3DS_EMAIL_DOMAIN` | `w3ds.invalid` | |
| `W3DS_EXTRA_RESERVED_USERNAMES` | empty | comma-separated; added to Forgejo's reserved list |
| `W3DS_MIN_WALLET_VERSION` | `0.4.0` | |
| `W3DS_OIDC_ALLOW_INSECURE` | `false` | local development only; see below |
| `PUBLIC_REGISTRY_URL` | — | already present in the root `.env` |

### The back channel must be TLS

`W3DS_OIDC_PUBLIC_URL` is the issuer, and Forgejo derives the token endpoint from it through discovery. It **must** be
`https://` in staging and production. This is not hardening: because goth never verifies the ID token signature, TLS
plus `client_secret` is the only thing distinguishing a real ID token from a forged one — see
[Trust model](#trust-model).

Plain HTTP is acceptable only for local development, where the bridge and Forgejo run on the same host. Anywhere else,
a bridge reachable over HTTP is an identity forgery endpoint for anyone who can intercept that connection. The bridge
refuses to start when `W3DS_OIDC_PUBLIC_URL` is not `https://`, unless `W3DS_OIDC_ALLOW_INSECURE=true` is set
explicitly — so the unsafe case has to be chosen, never inherited.

### GitW3 configuration

`ENABLE_AUTO_REGISTRATION` is a `MustBool()` with no default (`modules/setting/oauth2.go:71`), so it is `false`. Without
it a new W3DS user gets no account — they land on the linking page. `ALLOW_ONLY_INTERNAL_REGISTRATION` must also stay
`false` (`routers/web/auth/oauth.go:1103`).

```ini
[oauth2_client]
ENABLE_AUTO_REGISTRATION = true
ACCOUNT_LINKING = login       ; default — `auto` is an account takeover, see Trust model
USERNAME = nickname           ; default — works
REGISTER_EMAIL_CONFIRM = false ; see below — must be set here, not in [service]
```

#### Email confirmation locks W3DS accounts out permanently

New OAuth2 users are created with
`IsActive: !OAuth2Client.RegisterEmailConfirm && !Service.RegisterManualConfirm` (`routers/web/auth/oauth.go:1145`).
And `[oauth2_client] REGISTER_EMAIL_CONFIRM` inherits from `[service] REGISTER_EMAIL_CONFIRM` when it is not set
explicitly — `MustBool(Service.RegisterEmailConfirm)`, `modules/setting/oauth2.go:69`.

So on any instance that turns on email confirmation — ordinary hygiene for a public forge — every W3DS account is
created inactive and its activation mail is sent to a `w3ds.invalid` address that never delivers. The account cannot be
activated through the normal path, ever. For any other OIDC provider this works fine; it is specifically the synthetic
email that breaks it.

The override must go in `[oauth2_client]`, not `[service]`, or the inheritance takes over again. This costs nothing in
security: the W3DS signature is a stronger identity proof than an email round-trip, and the address is synthetic anyway,
so confirming it would prove nothing.

`REGISTER_MANUAL_CONFIRM` has the same effect and is read from `[service]` directly. It is less severe — an
administrator can activate the account by hand — but it should be a deliberate choice rather than a surprise, because
the symptom is the same: sign-in succeeds, the account exists, and login is refused.

The remainder of acceptance criterion 3 is configuration, not code: an OAuth2 authentication source of type OpenID
Connect, pointed at the bridge's discovery URL, with the source's `IconURL` field
(`services/auth/source/oauth2/source.go:20`) carrying the W3DS icon on the login button. Nothing in Forgejo is patched,
which preserves the fork's zero patch surface.

## Testing

**Unit — `claims.ts`, exhaustively.** This is the function that holds every trap: the leading `@`, consecutive
separators, truncation at 40, reserved names. Pure, dependency-free, so full edge-case coverage is nearly free.

One assertion in there is a regression guard rather than a behaviour check: for a reserved or unmappable ename, the
`nickname` and `preferred_username` keys must be **present with an empty value**. A test that only checks the value is
falsy would pass on an absent key, which is the crash case. Assert on key presence explicitly.

**Unit — flow protections, with `verifySignature` stubbed.** A code refused on second use. A `code_verifier` that does
not match. A `redirect_uri` differing by one character. An expired session. An `appVersion` of `0.3.9`. Each must fail,
and fail in the specified way.

**End to end — no phone required.** The [Dev Sandbox](../../../skills/w3ds/reference/dev-setup.md) is a complete wallet
substitute: provision an eVault, paste the `w3ds://auth` URI the bridge renders, and it signs the session and POSTs to
the callback. This exercises the whole chain including real signature verification against the Registry.

**Staging.** Acceptance criterion 5 requires the flow tested end to end in staging, so the walkthrough is repeated there
with a real eID Wallet. Debugging happens locally. Four things are checked in staging that cannot be checked anywhere
else:

- the discovery URL is `https://` and `W3DS_OIDC_ALLOW_INSECURE` is unset;
- `ACCOUNT_LINKING` is `login`, not `auto`;
- `REGISTER_EMAIL_CONFIRM` is `false` in `[oauth2_client]`, not inherited from `[service]`;
- a fresh ename gets an **active** account created, and signing in again reuses it rather than creating a second;
- a reserved name reaches the linking page and renders it, rather than panicking the handler. Enames are assigned by
  the Provisioner rather than chosen, so this is reached by adding an issued name to
  `W3DS_EXTRA_RESERVED_USERNAMES`, not by provisioning `@admin`.

## Acceptance criteria

| # | Criterion | Covered by |
|---|---|---|
| 1 | W3DS accepted as an authentication method | OAuth2 source of type OpenID Connect |
| 2 | Users sign in with their W3DS identity | wallet contract + `verifySignature` |
| 3 | W3DS login on the login page beside existing options | OAuth2 source config + `IconURL` |
| 4 | Successful auth creates or maps to a GitW3 account | `ENABLE_AUTO_REGISTRATION`, `external_login_user`, `claims.ts` |
| 5 | Flow tested end to end in staging | Dev Sandbox locally, real wallet in staging |

## Open items

Not blocking implementation.

- The W3DS protocol documentation says `w3id` where every implementation uses `ename`. Worth a separate fix.
- `appVersion` is documented as temporary and will be removed once the wallet rollout completes. The gate should be
  removable without touching anything else, so it stays in one place.
