---
sidebar_position: 7
title: Releases and PPA certification
description: Publish an exact semantic version, sign its PPA application, and follow version-scoped review decisions.
---

# Releases and PPA certification

PPA certification applies to one exact released version of a platform. Publishing new code or a new version does not inherit the previous version's certificate.

## Prepare the platform

The **PPA certificate** section on the repository's **W3DS** tab shows a checklist. Before an application can be signed, the repository needs:

- a ready permanent W3DS platform identity;
- at least one supported application domain;
- a public application URL;
- a published stable semantic Git release; and
- a repository or organization owner/admin signed in with an eID wallet.

## Publish the release

1. Merge and test the exact commit you intend to release.
2. Create a semantic version tag such as `v1.2.3`.
3. Push the tag to GitW3.
4. Open **Releases → New release**.
5. Select the tag, write release notes, leave it as a stable release, and publish.

GitW3 normalizes `v1.2.3` to platform version `1.2.3`, binds the version to the release commit, derives its version eName, and synchronizes the manifest. Wait for the **W3DS** tab to report the release as ready before applying.

Avoid mutable or ambiguous release tags. A draft, prerelease, or non-semantic tag such as `latest` does not become the W3DS platform version.

## Sign and submit the PPA application

Only a repository or organization owner/admin can submit the release.

1. Open the repository's **W3DS** tab.
2. Review every PPA checklist item and the exact version shown.
3. Select **Sign and apply for PPA certificate**.
4. Scan the QR code or open the connected eID wallet.
5. Review the release statement as your displayed eName.
6. Approve it and keep the dialog open until GitW3 verifies the signature.

The signing request is one-time and expires after 15 minutes. GitW3 validates the connected wallet's Registry certificate and P-256 signature. When verification succeeds, it commits the submission proof with `inSubmission: true` and stores the signed platform profile in the platform eVault.

Never invent or manually paste a submission proof into the manifest.

## Follow the review

The PPA area records the conversation for the current version, including:

- the original signed application;
- the signing actor and recorded time;
- the submitted, granted, or denied state;
- a reviewer reason when one was published; and
- signed responses and reapplications.

Possible states are:

| State | Meaning |
| --- | --- |
| Ready to apply | All prerequisites are satisfied and the version has no active decision. |
| Application submitted | The signed statement is stored and waiting in the PPA review queue. |
| PPA certificate granted | That exact version may be used in the GitW3 deployment flow. |
| PPA application denied | Address the decision and submit a signed response if reapplying. |

After a denial, enter a concise response explaining what changed or why the version should be reconsidered, then select **Sign and reapply**. The response becomes part of the next signed release statement and review history.

## Release a new version

For `v1.2.4` or any later version:

1. Publish a new stable release.
2. Wait for the manifest and version eName to synchronize.
3. Review the PPA checklist for the new version.
4. Sign and submit a new application.

The certificate for `1.2.3` remains a record for `1.2.3`; it does not certify `1.2.4`. The **Deploy** tab only enables releases for which PPA granted a certificate for the exact normalized version.
