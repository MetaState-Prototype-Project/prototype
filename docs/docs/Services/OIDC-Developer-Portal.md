---
sidebar_position: 3
---

# OIDC Developer Portal

The developer portal at **`https://oidc.w3ds.metastate.foundation/portal`** is where you register identity providers (IdPs) with the [W3DS OIDC Connector](./OIDC-Connector.md). Anyone with a W3DS eName can sign in and create as many clients as they need.

A **client** represents one IdP, for example a Keycloak realm or a Rauthy instance, that offers "Log in with W3DS". Each client has:
- a **client ID**, which is public, e.g. `w3ds_Qm9v3…`
- a **client secret**, which your IdP uses to authenticate to the connector
- one or more **redirect URIs**, the callback URLs of your IdP

## Signing in

1. Open `https://oidc.w3ds.metastate.foundation`, which takes you to the portal.
2. Scan the QR code with your eID wallet and approve. On a phone, tap **Open in eID Wallet** instead.
3. The page continues by itself and you are signed in as your eName.

You can only finish signing in in the browser where you opened the QR code. The session lasts 8 hours. **Sign out** is at the top of every page.

## Creating a client

1. Click **New client**.
2. Fill in the form:
   - **Name:** shown to your users on the W3DS login page and as the title of the approval card in their eID wallet, e.g. your organisation or product. Up to 64 characters.
   - **Logo URL** (optional): an `https` link to a square image (PNG, JPEG, WebP or SVG, at least 128×128 pixels). It is shown on the W3DS login page and in the eID wallet. Host it somewhere stable; if it fails to load, the connector's own logo is shown instead.
   - **Redirect URIs:** one per line, up to 10. These are your IdP's callback URLs: the URL your IdP shows when you add an OpenID Connect provider. The [provider guides](./OIDC-Provider-Guides.md) list them for popular products. Redirect URIs must use `https`; plain `http` is allowed only on `localhost`, for development. They must not contain a fragment (`#`). The connector matches them exactly, character for character.
   - **My identity provider requires an email address:** turn this on if your IdP refuses upstream logins without an email. The connector then sends `email: <username>@w3ds.invalid` with `email_verified: false`. These addresses can never receive mail and never match a real account.
3. Click **Create client**.
4. The next page shows your **client ID** and **client secret**, each with a **Copy** button.

:::warning
**Copy the client secret straight away.** It is shown only once and is stored only as a hash. If you lose it, [rotate it](#rotating-the-secret).
:::

The same page has a **Connection details** panel listing everything your IdP needs, with a copy button on each value: the discovery URL, issuer, endpoints, JWKS URL and scopes, plus the client authentication and PKCE settings. Most IdPs only need the discovery URL, client ID and client secret. Continue with [Connecting an identity provider](./OIDC-Connector.md#connecting-an-identity-provider), or the [guide for your IdP](./OIDC-Provider-Guides.md).

## Managing clients

**Clients** is a table of every client you own: its name, client ID (with a copy button), number of redirect URIs, whether it sends a synthetic email, and when it was created and last used. **Last used** updates each time your IdP exchanges a code, which makes it an easy way to confirm your IdP is set up correctly.

Click a client's name to open it. The client page shows its credentials and redirect URIs, the same **Connection details** panel as after creation, and its settings. Breadcrumbs at the top lead back to the list.

### Editing

You can change the name, the redirect URIs and the email setting at any time. Changes apply to the next login.

### Rotating the secret

**Rotate secret…** asks for confirmation, then shows a new secret once. **The old secret stops working immediately**, so logins through your IdP fail until you paste the new secret into it. Rotate whenever a secret may have leaked.

### Deleting

**Delete client…** asks for confirmation, then removes the client. Your IdP can no longer log users in with W3DS, and the deletion can't be undone. Accounts your IdP already created are not affected, since they live in your IdP.

## Limits and rules

| Rule | Limit |
| --- | --- |
| Clients per eName | Unlimited |
| Clients created per eName per hour | 10, counting clients deleted since |
| Redirect URIs per client | 10 |
| Client name | 1–64 characters |
| Redirect URI scheme | `https`, or `http` on `localhost` only |
| Logo URL | Optional; `https` only, up to 2048 characters |

Only the eName that created a client can see or change it. To anyone else, the client does not exist.

## Security notes

- **Treat the client secret like a password.** Store it only in your IdP's configuration.
- **The portal never shows a stored secret again**, and the connector never logs one.
- **Every change is recorded** in an audit log kept by the connector: creation, edits, secret rotation and deletion.
- **The client ID is not secret.** It appears in browser redirects.
