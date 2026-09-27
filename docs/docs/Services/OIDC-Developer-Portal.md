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

1. Open `https://oidc.w3ds.metastate.foundation`. It takes you to the portal.
2. Scan the QR code with your eID wallet and approve. On a phone, tap **Open in eID Wallet** instead.
3. The page continues by itself and you are signed in as your eName.

You can only finish signing in in the browser where you opened the QR code. The session lasts 8 hours. **Sign out** is at the top of every page.

## Creating a client

1. Click **New client**.
2. Fill in the form:
   - **Name:** shown to your users on the W3DS login page, e.g. your organisation or product. Up to 64 characters.
   - **Redirect URIs:** one per line, up to 10. These are your IdP's callback URLs:

     | Identity provider | Redirect URI |
     | --- | --- |
     | Keycloak | `https://<keycloak-host>/realms/<realm>/broker/<alias>/endpoint` |
     | Rauthy | `https://<rauthy-host>/auth/v1/providers/callback` |
     | Others | See the IdP's documentation for "redirect URI" or "callback URL" |

     Redirect URIs must use `https`; plain `http` is allowed only on `localhost`, for development. They must not contain a fragment (`#`). The connector matches them exactly, character for character.
   - **My identity provider requires an email:** turn this on for IdPs that refuse upstream logins without an email, such as Rauthy. The connector then sends `email: <username>@w3ds.invalid` with `email_verified: false`. These addresses can never receive mail and never match a real account.
3. Click **Create client**.
4. The next page shows your **client ID** and **client secret**.

:::warning
**Copy the client secret straight away.** It is shown only once and is stored only as a hash. If you lose it, [rotate it](#rotating-the-secret).
:::

The same page lists everything your IdP needs: the discovery URL, the issuer, and the client authentication and PKCE settings. Continue with [Connecting an identity provider](./OIDC-Connector.md#connecting-an-identity-provider).

## Managing clients

**Your clients** lists every client you own, with its client ID, number of redirect URIs, and when it was created and last used. **Last used** updates each time your IdP exchanges a code, which makes it an easy way to confirm your IdP is set up correctly.

Click a client to open it.

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

Only the eName that created a client can see or change it. To anyone else, the client does not exist.

## Security notes

- **Treat the client secret like a password.** Store it only in your IdP's configuration.
- **The portal never shows a stored secret again**, and the connector never logs one.
- **Every change is recorded** in an audit log kept by the connector: creation, edits, secret rotation and deletion.
- **The client ID is not secret.** It appears in browser redirects.
