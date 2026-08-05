# w3ds-oidc-bridge

An OpenID Connect provider that authenticates people with their W3DS identity.

GitW3 — the MetaState fork of Forgejo — has no plugin API, and the fork is kept at a patch surface of zero so upstream
security releases merge cleanly. So instead of teaching Forgejo about W3DS, this service speaks a protocol Forgejo
already understands. Forgejo believes it is talking to an ordinary OIDC provider. The wallet believes it is talking to
an ordinary W3DS platform. Neither is modified.

This works because OIDC never specifies *how* a provider authenticates someone. Here it is a QR code signed by an eID
wallet.

**Design:** [docs/superpowers/specs/2026-08-05-w3ds-oidc-bridge-design.md](../../docs/superpowers/specs/2026-08-05-w3ds-oidc-bridge-design.md)
**Plan:** [docs/superpowers/plans/2026-08-05-w3ds-oidc-bridge-plan.md](../../docs/superpowers/plans/2026-08-05-w3ds-oidc-bridge-plan.md)

## The two contracts

**Wallet side** is fixed by the platforms already in production. The bridge serves a QR encoding
`w3ds://auth?redirect=…&session=…&platform=gitw3`, built with `buildAuthOffer()` from `@metastate-foundation/auth` so it
cannot drift from the canonical format. The wallet signs **the session id itself** and POSTs
`{ ename, session, signature, appVersion }` back. The signature is checked against the Registry.

**Forgejo side** is fixed by `markbates/goth`. The ID token must carry `exp`, an `iss` byte-identical to the discovery
document, an `aud` matching the client id, a `sub`, and a non-empty `email`. Two of goth's behaviours shape the design
and are easy to get wrong: it never verifies the ID token signature, and an *absent* `preferred_username` claim panics
its account-linking page. Both are covered in the spec.

## Endpoints

| Forgejo-facing | |
|---|---|
| `GET /.well-known/openid-configuration` | discovery |
| `GET /authorize` | opens a session, serves the QR page |
| `POST /token` | code + `code_verifier` → ID token |
| `GET /userinfo` | served for conformance |
| `GET /jwks` | public key |

| W3DS-facing | |
|---|---|
| `POST /w3ds/callback` | wallet posts ename and signature |
| `GET /w3ds/events/:session` | SSE; tells the browser when to continue |

## Configuration

Read from the repository root `.env`. Every key without a default is required, and the service refuses to start without
it rather than failing later.

| Variable | Default | Note |
|---|---|---|
| `W3DS_OIDC_PUBLIC_URL` | — | the `issuer`; a trailing slash is stripped, because goth compares it byte for byte |
| `W3DS_OIDC_PORT` | `4200` | |
| `W3DS_OIDC_CLIENT_ID` | — | |
| `W3DS_OIDC_CLIENT_SECRET` | — | |
| `W3DS_OIDC_REDIRECT_URI` | — | GitW3's callback; compared exactly |
| `W3DS_OIDC_SIGNING_KEY` | — | ES256 private key, never committed |
| `W3DS_OIDC_KEY_ID` | — | stable `kid` |
| `W3DS_OIDC_ALLOW_INSECURE` | `false` | local development only |
| `W3DS_EMAIL_DOMAIN` | `w3ds.invalid` | synthetic addresses; they never deliver |
| `W3DS_EXTRA_RESERVED_USERNAMES` | empty | comma-separated, added to Forgejo's reserved list |
| `W3DS_MIN_WALLET_VERSION` | `0.4.0` | |
| `PUBLIC_REGISTRY_URL` | — | already in the root `.env` |

### The back channel must be TLS

`W3DS_OIDC_PUBLIC_URL` must be `https://` outside local development. Because goth never verifies the ID token
signature, TLS plus the client secret is the only thing separating a real ID token from a forged one. The service
refuses to start on `http://` unless `W3DS_OIDC_ALLOW_INSECURE=true` is set explicitly, so the unsafe case has to be
chosen rather than inherited.

## Wiring it into GitW3

Forgejo keeps authentication sources in its database rather than in `app.ini`, so they cannot be declared with the rest
of the configuration. [`docker/gitw3-register-auth-source.sh`](../../docker/gitw3-register-auth-source.sh) closes that
gap for deployments — it is idempotent, so it can run on every deploy. By hand it is **Site Administration →
Authentication Sources → Add**, type OAuth2, provider OpenID Connect.

| Field | Value |
|---|---|
| Auto Discovery URL | `<bridge>/.well-known/openid-configuration` |
| Client ID | `W3DS_OIDC_CLIENT_ID` |
| Client Secret | `W3DS_OIDC_CLIENT_SECRET` |
| Icon URL | `<bridge>/icon.svg` |

The bridge serves its own button icon, so there is nothing to host separately and the mark can never fall out of step
with the service. Forgejo renders it inside `<img width=28>`.

Then, in `app.ini`:

```ini
[oauth2_client]
ENABLE_AUTO_REGISTRATION = true
ACCOUNT_LINKING = login
USERNAME = nickname
REGISTER_EMAIL_CONFIRM = false
```

Only the first and last are changes from the defaults, and both matter. Without `ENABLE_AUTO_REGISTRATION` a new W3DS
user gets no account at all. Without `REGISTER_EMAIL_CONFIRM = false` **in this section** — it inherits `[service]`
otherwise — every account is created inactive and its activation mail is sent to an address that never delivers, which
locks the person out permanently.

`ACCOUNT_LINKING` must stay `login`. On `auto`, two eNames that sanitise to the same username let the second person
into the first person's account.

**Start the bridge before GitW3.** Forgejo fetches the discovery document once, when it registers the authentication
source at startup. If the bridge is down at that moment the source is not registered at all and the button vanishes
from the login page until GitW3 is restarted — with a confusing follow-on symptom, because an unregistered source also
stops Forgejo sending PKCE, and the bridge then rejects the request with `code_challenge is required`. Once registered,
the source survives a bridge restart.

## Running locally

```bash
pnpm --filter w3ds-oidc-bridge dev
```

Or as the container:

```bash
docker build -f docker/Dockerfile.w3ds-oidc-bridge -t w3ds-oidc-bridge .
```

## Deploying it with GitW3

[`docker-compose.gitw3.yml`](../../docker-compose.gitw3.yml) brings up both services with the startup order enforced by
a healthcheck, applies the four `[oauth2_client]` settings above through `FORGEJO__*` environment variables, and
registers the authentication source. It is a **candidate** manifest — nothing else in this repository deploys a
service, so it is a proposal to whoever owns the environment rather than an established convention.

```bash
docker compose -f docker-compose.gitw3.yml --env-file .env up -d
docker compose -f docker-compose.gitw3.yml restart gitw3   # first deploy only
```

The restart is needed once, because the source is created after GitW3 has already read its sources at boot.

One constraint has no workaround: GitW3 exchanges the authorization code over the bridge's **public** hostname, since
the discovery document publishes absolute URLs. `http://w3ds-oidc-bridge:4200` would fail the issuer comparison, so the
container has to resolve its own public name.

## Testing without a phone

The [Dev Sandbox](../../infrastructure/dev-sandbox) is a full wallet substitute. Provision an eVault, copy the
`w3ds://auth` URI from the bridge's QR page, paste it into the sandbox and click **Perform** — it signs the session and
POSTs to the callback, exercising the whole chain including real signature verification against the Registry.

```bash
pnpm --filter w3ds-oidc-bridge test
```
