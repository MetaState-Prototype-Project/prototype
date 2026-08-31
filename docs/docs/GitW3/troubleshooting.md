---
sidebar_position: 9
title: Troubleshooting GitW3
description: Diagnose sign-in, Git authentication, manifest publication, porting, PPA, and deployment problems safely.
---

# Troubleshooting GitW3

Start with the repository's **W3DS** tab. It reads current W3DS publication state whenever the page loads, and repository administrators can see the publisher's detailed last error.

## Sign-in and profile

### The wallet QR expired

Reload the sign-in page and approve a new request. Wallet sign-in requests are intentionally short-lived.

### The name or avatar is stale

GitW3 enriches the local account from the newest W3DS person profile in AaaS during sign-in. Sign out and sign in again. AaaS failure does not block authentication, so an older profile may remain during an outage.

### A username-and-password form appears

The production user login should offer **Sign in with W3DS**, not a local password form. Make sure you are using `https://git.w3ds.metastate.foundation/user/login` and report the page URL and time to the GitW3 operator. Do not enter a reused password into an unexpected form.

## Clone and push

### Browser sign-in works, but Git rejects credentials

The browser wallet session does not authenticate command-line Git. Add an SSH key and use the SSH clone URL, or create a personal access token and use it as the HTTPS password.

### The remote owner starts with `@`

The UI `@` is cosmetic. Replace a hand-typed URL with the exact HTTP or SSH URL from the repository clone control.

### Pushes go to the old provider

Inspect remotes:

```bash
git remote -v
```

For a ported application, preserve the old remote under `upstream` and make the GitW3 URL `origin`. Return to the repository's `/onboarding/port` page for the exact generated instructions.

## Manifest and identity publication

### The platform eName is still pending

Provisioning is asynchronous and GitW3 retries temporary W3DS failures. Confirm `.w3ds/platform.json` exists on the default branch, then refresh the **W3DS** tab. If the administrator view shows a persistent error, report that exact error without including secrets.

### GitW3 says the manifest is invalid

Validate that `.w3ds/platform.json` is well-formed JSON and contains the supported schema. Do not fix it by inventing an eName or proof. Compare the core fields with [Platform manifest and W3DS workspace](./platform-manifest-and-workspace), preserve any existing assigned identity, and push the correction to the default branch.

### A W3DS workspace edit conflicts

Another commit changed the default branch after the page loaded. Pull or reload, review the newer manifest, and apply the edit again. GitW3 deliberately refuses to overwrite the newer commit silently.

### The marketplace listing is missing

Check all three states:

1. the permanent identity is ready;
2. the profile synchronization completed; and
3. `isDraft` is `false` through the **Publish platform** visibility control.

A draft profile remains hidden even when its identity is ready.

## Existing application port

### eName migration says to push first

The destination default branch has not received the application. Push the existing checkout, including a valid `.w3ds/platform.json`, then use **Check for pushed code** on the handoff page. Step 2 is intentionally locked until code exists.

### The existing eName conflicts with the manifest

Stop. GitW3 will not replace a different eName already present in the destination manifest. Verify that you selected the correct source application and destination repository before making any change.

### The token is rejected

Use the current raw token for the exact existing platform eName. GitW3 must find exactly one matching valid `PlatformProfile`, and the connected wallet must be named as an author. The token is not retained, so the same original value is required again during activation.

### The wallet is not an author

Sign in with an eID wallet named by the existing platform profile. For a legacy profile with no authors, complete the signed request and wait for site administrator review.

### The migration is staged but the old listing is still live

That is expected. Staging does not cut over the public platform. Publish the required stable release, then have a repository or organization administrator open **W3DS**, review the staged migration, re-enter the original token, and explicitly activate it.

## Releases and PPA

### The release requirement is not ready

Publish a stable release with a semantic tag such as `v1.2.3`. Draft releases, prereleases, and non-semantic tags do not control the platform version. Wait for the publisher to synchronize the normalized version before applying.

### The PPA button is disabled

Check the on-page requirements: stable identity, domains, public application URL, stable release, owner/admin permissions, and a connected eID wallet. Every item must be ready for the exact current version.

### The signing request expired

Close the dialog and start a fresh application. Do not reuse a signing URL or attempt to construct a proof manually.

### A prior version was granted, but deployment is disabled

PPA decisions are version-scoped. Publish and obtain a certificate for the exact new version selected in the deployment wizard.

## Deployment

### No release can be selected

Confirm that the release is stable, semantic, synchronized to the platform manifest, and granted a PPA certificate for that exact normalized version.

### The downloaded deployment key is missing

Do not continue under the assumption that GitW3 can recover it. Generate a new key before signing if the wizard is still open, or register a new deployment identity if the signed deployment has already been published.

### Publication is waiting for W3DS

Leave the deployment record intact and refresh later. GitW3 separates repository availability from W3DS publisher retries. If the status becomes **Needs attention**, report the displayed failure to the operator without sharing the private key.

### The server key does not match the deployment

Fail closed. Derive the public key from the PKCS#8 private key and compare it to the public key shown on the deployment record. Never work around a mismatch by changing the expected key in code; mount the correct secret or create a new deployment identity.

## Information safe to include in a support report

Include the repository path, page URL, approximate time, release tag, public eNames, public deployment key, displayed status, and a sanitized error message. Never include wallet secrets, personal access tokens, migration tokens, session cookies, or the contents of `w3ds-deployment-key.json`.
