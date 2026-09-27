---
sidebar_position: 2
---

# OIDC Connector

The W3DS OIDC Connector lets any OpenID Connect identity provider (IdP) offer **"Log in with W3DS"**. It is an OIDC provider whose only login step is a signature from the user's eID wallet. Keycloak, Rauthy, Authentik, Zitadel, Auth0, Okta and similar products add it as an upstream provider, the same way they add "Log in with Google". The IdP needs no plugins or code changes, and neither do the apps behind it.

The hosted service runs at **`https://oidc.w3ds.metastate.foundation`**.

| | |
| --- | --- |
| Discovery URL | `https://oidc.w3ds.metastate.foundation/.well-known/openid-configuration` |
| Issuer | `https://oidc.w3ds.metastate.foundation` |
| Developer portal | `https://oidc.w3ds.metastate.foundation/portal` (the bare URL redirects here) |

To use it:
1. Sign in to the [developer portal](./OIDC-Developer-Portal.md) with your eID wallet and create a client.
2. Add the connector to your IdP as described [below](#connecting-an-identity-provider), or follow a [guide for your IdP](./OIDC-Provider-Guides.md).

## Why it exists

Organisations don't add login to each app. They run an IdP, and their apps trust it. Building W3DS into each IdP natively would mean a separate plugin per product:
- Keycloak needs a Java extension.
- Rauthy has no plugin system.
- Hosted IdPs such as Auth0, Okta or Entra allow no custom server code.

Every IdP already supports upstream OIDC providers, so one connector that speaks OIDC brings W3DS login to all of them through configuration alone.

## What it proves

The connector proves one fact: **this browser belongs to the holder of eName X**. It returns that fact as a signed ID token.

It stores no users, passwords or profile data. Users, roles, groups and sessions stay in your IdP. The only data it keeps is the list of clients that developers register in the portal.

```
Your apps --OIDC--> Your IdP (Keycloak, Rauthy, …) --OIDC--> oidc.w3ds.metastate.foundation --w3ds://auth--> eID wallet
                                                                        |
                                                                        +--verify key--> W3DS Registry + eVault
```

## Login flow

1. **Your IdP redirects the browser** to `https://oidc.w3ds.metastate.foundation/authorize` with your client ID, `state`, `nonce` and a PKCE S256 challenge.
2. **The connector shows a QR code.** It checks the client and redirect URI, creates a random session S, and shows a QR code for `w3ds://auth?redirect=…/w3ds/callback&session=S&platform=…`. On a phone, the **Open in eID Wallet** button opens the same link.
3. **The wallet signs.** It signs S with the user's P-256 key and posts `{ename, session, signature}` to the connector. On a phone it opens `…/deeplink-login` in the browser instead.
4. **The connector verifies and hands back a code.** After verifying the signature (see below), it gives a one-time authorization code to **the browser that started the login, and only that browser**. The browser returns to your IdP.
5. **Your IdP finishes the login.** It exchanges the code at `/token`, checks the ID token against `/jwks`, and logs the user in.

## Endpoints

All paths are relative to `https://oidc.w3ds.metastate.foundation`.

| Endpoint | Called by | Purpose |
| --- | --- | --- |
| `GET /.well-known/openid-configuration` | IdP | Discovery |
| `GET /jwks` | IdP | Public key for validating ID tokens |
| `GET /authorize` | Browser | Starts a login and shows the QR page |
| `POST /token` | IdP | Exchanges a code and PKCE verifier for an ID token |
| `GET /userinfo` | IdP | Returns the same user claims as the ID token |
| `POST /w3ds/callback` | eID wallet | Receives the signed session |
| `GET /deeplink-login` | eID wallet (mobile) | Receives the signed session in the browser |
| `GET /w3ds/events/:session` | Browser | Tells the login page when the wallet has signed |
| `GET /` | Browser | Redirects to the developer portal |
| `GET /portal` | Developers | [Developer portal](./OIDC-Developer-Portal.md) |
| `GET /healthz` | Orchestrator | Health check |

**Protocol details:**

| | |
| --- | --- |
| Grant type | Authorization code only |
| PKCE | **Required**, `S256` only |
| Client authentication | `client_secret_basic` or `client_secret_post` |
| ID token signing | ES256 |
| Scopes | `openid` (required), `profile`, `email` |
| `prompt=none` | Always fails with `login_required`: every login needs the wallet |

## Claims

| Claim | Value | Notes |
| --- | --- | --- |
| `sub` | The eName, e.g. `@e4d1c2b0-5a6f-…` | Stable identifier. **Link accounts on this.** |
| `preferred_username` | The eName without `@`, lowercased and sanitised | A suggestion only. Two eNames can sanitise to the same value. |
| `email` | `<username>@w3ds.invalid` | Only for clients with **"requires an email"** turned on. The `.invalid` domain can never receive mail. |
| `email_verified` | `false` | Sent with `email`. Stops IdPs from linking accounts by email. |
| `amr` | `["hwk"]` or `["swk"]` | Hardware or software wallet key (RFC 8176). See the note below. |
| `iss`, `aud`, `exp`, `iat`, `auth_time`, `nonce` | Standard OIDC values | |

:::caution
`amr` is a hint, not an attestation. It is inferred from how the wallet encoded its signature: hardware keys use multibase base58btc and software keys use base64. Neither the wallet nor the Registry attests the key type, so do not use `hwk` as a security boundary.
:::

## Security properties

- **The connector fails closed.**
  - An eName with no key binding certificate is rejected.
  - Registry and eVault calls time out after 5 seconds, and a timeout means the login fails.
  - Certificates are never cached, so a revoked or rotated key takes effect on the next login.
- **Signatures are checked against certified keys.** The connector resolves the eName at the Registry, fetches its key binding certificates from the eVault's `/whois`, checks each certificate against the Registry's JWKS, and verifies the ECDSA P-256 / SHA-256 signature over the session ID with a certified key.
- **The login is bound to one browser.** Anyone can read session S off a QR code and get a wallet to sign it. Only the browser that opened the QR page holds the HttpOnly cookie needed to collect the resulting code.
- **Everything is single use.** Sessions and codes can each be used once. A replayed code is rejected, and it revokes the access tokens already issued from it. PKCE is mandatory.
- **Client secrets are generated by the connector** (256-bit), stored only as hashes, and shown only once.

## Connecting an identity provider

Any identity provider that can add a generic OpenID Connect provider can use the connector. The IdP must support:
- the authorization code flow **with PKCE (`S256`)**, which the connector requires;
- a confidential client that authenticates with `client_secret_basic` or `client_secret_post`;
- validating ES256-signed ID tokens against a JWKS URL.

To connect one:
1. **Create a client.** In the [developer portal](./OIDC-Developer-Portal.md), create a client whose redirect URI is your IdP's callback URL. Your IdP shows this URL when you add an OpenID Connect provider.
2. **Add a provider in your IdP.** Add an OpenID Connect provider. Depending on the product it may be called an external, upstream, social or federated identity provider, or an enterprise connection.
3. **Enter the connection values.** The portal lists all of these with copy buttons:

   | Setting | Value |
   | --- | --- |
   | Discovery URL | `https://oidc.w3ds.metastate.foundation/.well-known/openid-configuration` |
   | Issuer | `https://oidc.w3ds.metastate.foundation` |
   | Client ID and client secret | From the portal |
   | Client authentication | Client secret over HTTP Basic (`client_secret_basic`), or in the request body (`client_secret_post`) |
   | PKCE | On, method `S256` |
   | Scopes | `openid profile`, plus `email` if the client has "requires an email" turned on |
   | Signature validation | On, using the JWKS URL from discovery |

   If your IdP can't read the discovery document, enter the endpoints yourself: `/authorize`, `/token`, `/userinfo` and `/jwks` under the issuer.
4. **Map the claims.**
   - Use `sub` as the stable user identifier, and link accounts on it.
   - Use `preferred_username` as the suggested username.
   - Never trust the email or link accounts on it: it is synthetic and unverified.
5. **Test it.** Log in through your IdP. The client's **Last used** time in the portal updates once your IdP has exchanged a code.

For step-by-step instructions for specific products, such as Keycloak and Rauthy, see the [OIDC Provider Guides](./OIDC-Provider-Guides.md).

## Running your own connector

The code lives in `services/w3ds-oidc-connector`. It is a single Node.js service backed by Postgres.

```bash
docker build -f docker/Dockerfile.w3ds-oidc-connector -t w3ds-oidc-connector .
docker run --rm --env-file connector.env w3ds-oidc-connector node dist/scripts/migrate.js
docker run -d --env-file connector.env -p 4200:4200 w3ds-oidc-connector
```

**Settings:**

| Variable | Default | Purpose |
| --- | --- | --- |
| `W3DS_OIDC_ISSUER` | required | Public origin, e.g. `https://oidc.w3ds.metastate.foundation`. Must have no path, because the wallet's mobile deep link drops it. Must be https in production. |
| `W3DS_OIDC_DATABASE_URL` | required | Postgres connection string |
| `DB_CA_CERT` | none | CA certificate, if Postgres uses TLS |
| `PUBLIC_REGISTRY_URL` | required | The W3DS Registry, e.g. `https://registry.w3ds.metastate.foundation` |
| `W3DS_OIDC_SIGNING_KEY_JWK` | ephemeral in dev | ES256 private JWK that signs ID tokens. Required in production. Generate one with `pnpm --filter w3ds-oidc-connector generate-jwk`. |
| `W3DS_OIDC_PORTAL_SECRET` | ephemeral in dev | At least 32 characters. Signs portal sessions. Required in production. |
| `W3DS_OIDC_PLATFORM_NAME` | `W3DS Login` | Shown in the wallet and on the login pages |
| `W3DS_OIDC_CLIENT_CREATE_LIMIT` | `10` | Clients one eName may create per hour |
| `W3DS_OIDC_DOCS_URL` | `https://docs.w3ds.metastate.foundation/docs/Services` | Where the portal links for documentation and provider guides |
| `W3DS_OIDC_PORT` | `4200` | Listen port |
| `W3DS_OIDC_SESSION_TTL_SECONDS` | `300` | How long a QR code stays valid |
| `W3DS_OIDC_CODE_TTL_SECONDS` | `60` | How long a code can be exchanged |
| `W3DS_OIDC_TOKEN_TTL_SECONDS` | `300` | ID token and access token lifetime |
| `W3DS_OIDC_UPSTREAM_TIMEOUT_MS` | `5000` | Registry and eVault timeout |
| `W3DS_OIDC_JWKS_CACHE_SECONDS` | `300` | How long the Registry's JWKS is reused |
| `W3DS_OIDC_TRUST_PROXY` | off | Express `trust proxy`, e.g. `1` behind one ingress |

**Operating notes:**
- **Migrations first.** Run `node dist/scripts/migrate.js` (or `pnpm --filter w3ds-oidc-connector migrate` from a checkout) before each start. The service refuses to start while migrations are pending.
- **Single instance.** Login sessions, codes and access tokens live in memory, so run one replica. A restart cancels logins in progress; users simply scan again. Clients live in Postgres and survive restarts.
- **Serve it at the root of its own origin, over TLS.** Behind a reverse proxy, set `W3DS_OIDC_TRUST_PROXY`, and make sure the proxy does not buffer `/w3ds/events` (it is a server-sent event stream).
- **Health.** `/healthz` reports the process only, not the Registry. An unreachable Registry makes logins fail closed rather than restarting the container.
- **Local testing.** Some identity providers refuse to talk to a plain-`http` connector; see the [provider guides](./OIDC-Provider-Guides.md) for how to test with them locally.
