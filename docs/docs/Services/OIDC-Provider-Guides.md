---
sidebar_position: 4
---

# OIDC Provider Guides

Step-by-step instructions for connecting specific identity providers (IdPs) to the [W3DS OIDC Connector](./OIDC-Connector.md). The general steps, which work for any OpenID Connect IdP, are in [Connecting an identity provider](./OIDC-Connector.md#connecting-an-identity-provider).

Every guide starts the same way: sign in to the [developer portal](./OIDC-Developer-Portal.md) at `https://oidc.w3ds.metastate.foundation` and create a client. Each guide says which redirect URI to register and whether to turn on **"My identity provider requires an email address"**. The portal shows the client ID, the client secret (once) and every connection value, each with a copy button.

| Provider | Redirect URI to register | Requires an email | Tested |
| --- | --- | --- | --- |
| [Keycloak](#keycloak) | `https://<keycloak-host>/realms/<realm>/broker/<alias>/endpoint` | No | Yes |
| [Rauthy](#rauthy) | `https://<rauthy-host>/auth/v1/providers/callback` | Yes | Yes |
| [Others](#other-identity-providers) | Shown by your IdP when you add an OIDC provider | Depends | No |

## Keycloak

Tested with Keycloak 26.

1. **Create a client.** In the portal, create a client with:
   - Redirect URI: `https://<keycloak-host>/realms/<realm>/broker/w3ds/endpoint`. Replace `w3ds` if you choose a different alias in step 3.
   - **"My identity provider requires an email address"** turned off.
2. **Add the provider.** In the Keycloak admin console, open your realm, go to **Identity providers**, and choose **OpenID Connect v1.0**.
3. **Fill in the provider settings:**
   - **Alias:** `w3ds`
   - **Display name:** `W3DS`
   - **Discovery endpoint:** `https://oidc.w3ds.metastate.foundation/.well-known/openid-configuration`. Keycloak fills in the remaining URLs itself.
   - **Client authentication:** *Client secret sent as basic auth*
   - **Client ID** and **Client secret:** from the portal
4. **Set the advanced options:**
   - Turn on **Use PKCE**, with method **S256**.
   - Turn on **Validate signatures** and **Use JWKS URL**.
   - Set **Scopes** to `openid profile`.
   - Turn **Trust Email** off.
5. **Add mappers** under the provider's **Mappers** tab:
   - **Username Template Importer**, with template `${CLAIM.preferred_username}`
   - **Attribute Importer**, from claim `sub` to user attribute `w3ds_ename`
6. **Handle email.** The connector sends Keycloak no email. Either make email optional in the realm's **User profile**, or keep the default first-login *Review profile* step so users add one themselves.
7. **Test it.** Your realm's login page now shows **W3DS**. To skip Keycloak's login page, apps send `kc_idp_hint=w3ds`.

## Rauthy

Tested with Rauthy 0.36.

1. **Create a client.** In the portal, create a client with:
   - Redirect URI: `https://<rauthy-host>/auth/v1/providers/callback`
   - **"My identity provider requires an email address"** turned **on**. Rauthy refuses upstream logins that carry no email.
2. **Look up the provider.** In the Rauthy admin UI, go to **Providers**, then **Add New**, and leave the mode on **OIDC**. Enter the **Issuer URL** `https://oidc.w3ds.metastate.foundation` and click **Lookup**. Rauthy discovers the endpoints and turns PKCE on.
3. **Fill in the provider settings:**
   - **Scope:** `openid profile email`
   - **Client name:** e.g. `W3DS`
   - **Client ID** and **Client secret:** from the portal
   - Tick **client_secret_basic**
4. **Save**, then open the new provider. Tick **Enabled** and **Auto-Onboarding**, then save again.

   :::note
   Without **Auto-Onboarding**, Rauthy rejects every new W3DS user with "User not found". It only lets through users that already exist and have linked W3DS.
   :::

5. **Link existing accounts (optional).** Existing Rauthy users can link W3DS from their account page. Rauthy rejects an upstream login whose email collides with an unlinked local account; the connector's `@w3ds.invalid` addresses never collide.
6. **Test it.** Rauthy's login page now shows the provider. To skip Rauthy's login page, apps send `idp_hint=<provider id>`.

:::tip Testing against a local connector
Rauthy's outbound HTTP client refuses plain `http` URLs. To test against a connector running on `http://localhost` or a LAN address, start Rauthy with **both** `DEV_MODE=true` and `HTTP_DANGER_UNENCRYPTED=true`. Dev mode loads Rauthy's test data, so the admin login becomes `admin@localhost` / `123SuperSafe`. Never use these settings in production; the hosted connector is served over https.
:::

## Other identity providers

Authentik, Zitadel, Auth0, Okta, Microsoft Entra ID and other products that support generic OpenID Connect federation connect the same way. Follow [Connecting an identity provider](./OIDC-Connector.md#connecting-an-identity-provider). These have not yet been tested with the connector, so check the following before relying on one:

- **PKCE.** The connector requires PKCE with `S256`. An IdP that cannot send a PKCE challenge to an upstream provider cannot use the connector; the login fails with `invalid_request` ("a PKCE S256 code_challenge is required").
- **Email.** If the IdP refuses users without an email, turn on **"My identity provider requires an email address"** for the client, and add the `email` scope.
- **Account linking.** Configure the IdP to identify users by the `sub` claim, not by email.

If you connect another product, please contribute a guide to this page.
