---
sidebar_position: 8
---

# OIDC Connector

The W3DS OIDC Connector is a small OpenID Connect provider whose login step is a W3DS wallet signature. An organisation's identity provider (IdP) adds it as an upstream provider, the same way it adds "Log in with Google". The IdP needs no plugins or code changes, and neither do the apps behind it.

It lives in `services/w3ds-oidc-connector`.

## Why it exists

Organisations don't add login to each app. They run an IdP such as Keycloak or Rauthy, and their apps trust it. Getting W3DS into an IdP natively would mean a separate plugin per product: Keycloak needs a Java extension, Rauthy has no plugin system, and hosted IdPs such as Auth0, Okta or Entra allow no custom server code.

Every IdP already supports upstream OIDC providers, so a connector that speaks OIDC gives W3DS login to all of them through configuration alone.

## What it proves

The connector proves one fact: **this browser belongs to the holder of eName X**. It returns that fact as a signed ID token.

It stores no users, passwords or profile data. Users, roles, groups and sessions stay in the IdP.

```
Your apps --OIDC--> Keycloak / Rauthy / any IdP --OIDC--> W3DS OIDC Connector --w3ds://auth--> eID wallet
                                                                  |
                                                                  +--verify key--> Registry + eVault
```

## Login flow

1. The IdP sends the browser to the connector's `/authorize` with its client ID, `state`, `nonce` and a PKCE S256 challenge.
2. The connector checks the client and redirect URI and creates a random session S. It then shows a QR code for `w3ds://auth?redirect=<connector>/w3ds/callback&session=<S>&platform=<name>` and waits on an event stream. On a phone, the "Open in eID Wallet" button opens the same link.
3. The wallet signs S with the user's P-256 key and posts `{ename, session, signature}` to the callback. On mobile it opens `<connector>/deeplink-login?ename&session&signature` in the browser instead.
4. The connector verifies the signature (see below). It then hands a one-time code to the browser that started the login, and only to that browser, and the browser follows the redirect back to the IdP.
5. The IdP exchanges the code at `/token`, checks the ID token against `/jwks`, and logs the user in.

Session S is bound to the browser that opened `/authorize` by an HttpOnly cookie. Anyone who reads S off the QR code can get a wallet to sign it, but cannot collect the resulting code.

## Endpoints

| Endpoint | Called by | Purpose |
| --- | --- | --- |
| `GET /.well-known/openid-configuration` | IdP | Discovery |
| `GET /jwks` | IdP | Public key for validating ID tokens |
| `GET /authorize` | Browser | Starts a login and renders the QR page |
| `POST /token` | IdP | Exchanges a code and PKCE verifier for an ID token |
| `GET /userinfo` | IdP | Returns the same user claims as the ID token |
| `POST /w3ds/callback` | eID wallet | Receives the signed session |
| `GET /deeplink-login` | eID wallet (mobile) | Receives the signed session in the browser |
| `GET /w3ds/events/:session` | Browser | Event stream that delivers the code on approval |
| `GET /healthz` | Orchestrator | Health check |

Only the authorization code flow with PKCE S256 is supported. Clients authenticate with `client_secret_basic` or `client_secret_post`. ID tokens are signed with ES256.

## Verifying the wallet signature

On a wallet callback, the connector:

1. Checks that the session exists, is still pending, and is under 5 minutes old.
2. Resolves the eName at the Registry: `GET <registry>/resolve?w3id=<eName>`.
3. Fetches key binding certificates from the eVault: `GET <evault>/whois` with the header `X-ENAME: <eName>`.
4. Verifies each certificate against the Registry's keys at `<registry>/.well-known/jwks.json`, and checks that it has not expired and that its `ename` matches.
5. Verifies the wallet's ECDSA P-256 / SHA-256 signature over the session ID with each certified key.
6. If any key verifies, it approves the session. If none do, it returns 401 and leaves the session pending so the user can retry.

The connector fails closed:

- An eName with **no** key binding certificates is rejected.
- Registry and eVault calls time out (5 seconds by default).
- `/whois` is never cached, so key changes take effect on the next login.

This is `verifyEnameSignature` in `@metastate-foundation/auth` (import it from `@metastate-foundation/auth/ename`). The older `verifyLoginSignature` accepts an eName with no certificates, so the connector does not use it.

## Claims

| Claim | Value | Notes |
| --- | --- | --- |
| `sub` | The eName, e.g. `@e4d1c2b0-5a6f-...` | Stable ID. IdPs must link accounts on this. |
| `preferred_username` | The eName without `@`, lowercased and sanitised | A suggestion only. Two eNames can sanitise alike. |
| `email` | `<username>@w3ds.invalid` | Only for clients configured with `synthetic_email`. `.invalid` can never receive mail. |
| `email_verified` | `false` | Stops IdPs from linking accounts by email. |
| `amr` | `["hwk"]` or `["swk"]` | Hardware or software wallet key (RFC 8176). |
| `iss`, `aud`, `exp`, `iat`, `auth_time`, `nonce` | Standard OIDC values | |

`amr` is a hint, not an attestation. It is inferred from how the signature was encoded: hardware keys send multibase base58btc and software keys send base64. Neither the wallet nor the Registry attests the key type, so relying parties must not treat `hwk` as a security boundary.

## Configuration

The connector reads its settings from environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `W3DS_OIDC_ISSUER` | required | Public origin, e.g. `https://id.example.com`. Must have no path: the wallet's mobile deep link drops it. Must be https in production. |
| `W3DS_OIDC_PORT` | `4200` | Listen port |
| `W3DS_OIDC_PLATFORM_NAME` | `W3DS Login` | Shown in the wallet and on the login page |
| `PUBLIC_REGISTRY_URL` | required | The W3DS Registry |
| `W3DS_OIDC_SIGNING_KEY_JWK` | ephemeral in dev | ES256 private JWK. Required in production. |
| `W3DS_OIDC_CLIENTS` or `W3DS_OIDC_CLIENTS_FILE` | required | Client list as JSON, inline or from a file |
| `W3DS_OIDC_SESSION_TTL_SECONDS` | `300` | How long a QR code stays valid |
| `W3DS_OIDC_CODE_TTL_SECONDS` | `60` | How long a code can be exchanged |
| `W3DS_OIDC_TOKEN_TTL_SECONDS` | `300` | ID token and access token lifetime |
| `W3DS_OIDC_UPSTREAM_TIMEOUT_MS` | `5000` | Registry and eVault timeout |
| `W3DS_OIDC_JWKS_CACHE_SECONDS` | `300` | How long the Registry JWKS is reused |
| `W3DS_OIDC_TRUST_PROXY` | off | Express `trust proxy`, e.g. `1` behind one ingress |

Generate a signing key with:

```bash
pnpm --filter w3ds-oidc-connector generate-jwk
```

### Registering a client

Each IdP that uses the connector is a client:

```json
[
    {
        "client_id": "keycloak",
        "client_secret_hash": "scrypt:16384:8:1:...",
        "redirect_uris": ["https://kc.example.com/realms/main/broker/w3ds/endpoint"],
        "synthetic_email": false,
        "name": "Example Corp"
    }
]
```

- `redirect_uris` are matched exactly and must use https (http is allowed only on localhost).
- `synthetic_email` adds the `@w3ds.invalid` email claim for IdPs that require an email from upstream providers.
- `name` is shown on the login page.

Secrets are stored hashed. Generate a new secret and its hash with:

```bash
pnpm --filter w3ds-oidc-connector hash-secret --generate
```

To hash an existing secret, pipe it in: `echo -n "<secret>" | pnpm --filter w3ds-oidc-connector hash-secret`.

## Connecting Keycloak

1. Register a client on the connector with the redirect URI `https://<keycloak>/realms/<realm>/broker/w3ds/endpoint`.
2. In Keycloak, add an identity provider of type **OpenID Connect v1.0** with:
   - alias `w3ds`
   - discovery URL `https://<connector>/.well-known/openid-configuration`
   - the client ID and secret, using client authentication "Client secret sent as basic auth"
3. Turn on **Validate signatures**, **Use JWKS URL** and **PKCE** (method S256). Set the scopes to `openid profile`, and turn **Trust email** off.
4. Add two mappers:
   - **Username Template Importer** with `${CLAIM.preferred_username}`
   - **Attribute Importer** from `sub` to a `w3ds_ename` attribute
5. Make email optional in the realm's user profile, or keep the Review Profile step so users add one on first login.
6. To skip Keycloak's login page, apps send `kc_idp_hint=w3ds`.

## Connecting Rauthy

1. Register a client on the connector with the redirect URI `https://<rauthy>/auth/v1/providers/callback` and `"synthetic_email": true`. Rauthy requires an email from upstream providers.
2. In the Rauthy admin UI, add a custom upstream provider with:
   - the connector's issuer URL (endpoints are auto-discovered)
   - the client ID and secret
   - scope `openid profile email`
   - PKCE on
3. Enable auto-onboarding if new W3DS users may sign up on their own.
4. Existing Rauthy users link W3DS from their account page. Rauthy rejects an upstream login whose email collides with an unlinked local account.
5. To skip Rauthy's login page, apps send `idp_hint=<provider id>`.

Any other IdP with generic OIDC federation, such as Authentik, Zitadel, Auth0 or Okta, connects the same way: register a client and point the IdP at the discovery URL.

## Operating it

- **Single instance.** Sessions, codes and access tokens live in memory, so run one replica. A restart cancels logins in progress; users simply scan again.
- **Serve it at the root of its own origin, over TLS.** Behind a reverse proxy, set `W3DS_OIDC_TRUST_PROXY`, and make sure the proxy does not buffer the `/w3ds/events` stream.
- **Health.** `/healthz` reports the process only, not the Registry. An unreachable Registry makes logins fail closed rather than restarting the container.
- **Docker.** Build with `docker build -f docker/Dockerfile.w3ds-oidc-connector .`
