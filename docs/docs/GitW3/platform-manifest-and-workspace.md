---
sidebar_position: 6
title: Platform manifest and W3DS workspace
description: Understand .w3ds/platform.json, asynchronous publication, visibility, and the repository W3DS tab.
---

# Platform manifest and W3DS workspace

Every GitW3 platform repository owns a manifest at `.w3ds/platform.json`. It is version-controlled platform metadata and the source from which GitW3 publishes the platform profile to W3DS.

## Manifest shape

A newly created platform starts with the following core fields:

```json
{
  "schemaVersion": 1,
  "platformName": "example-platform",
  "displayName": "Example Platform",
  "description": "A short description of the platform.",
  "version": "0.1.0",
  "ename": null,
  "url": "https://example.invalid",
  "logoUrl": "https://example.invalid/logo.png",
  "domains": ["productivity", "work"],
  "inSubmission": false,
  "submissionVersion": "",
  "isDraft": true
}
```

Use real W3DS ontology domain identifiers from the GitW3 selector. The values above are illustrative.

## Who controls each field

| Field | Control and behavior |
| --- | --- |
| `schemaVersion` | Manifest format version. Do not change it without a supported schema migration. |
| `platformName` | Stable machine-facing platform slug derived at creation. Immutable after identity creation. |
| `displayName` | Human-facing name. Editable by permitted repository users. |
| `description` | Human-facing platform description. |
| `version` | Synchronized from the latest stable semantic GitW3 release; do not manually bump it. |
| `ename` | Permanent platform eName. Initially `null`, then written by the publisher or preserved by the port flow. Immutable once assigned. |
| `url` | Public application URL. Required for PPA submission. |
| `logoUrl` | Optional public logo URL. |
| `domains` | One or more supported W3DS application-domain identifiers. |
| `inSubmission` | Whether the current release statement is in the PPA review flow. Managed by the signed application workflow. |
| `submissionVersion` | Version associated with the current signed PPA submission. |
| `isDraft` | Controls whether the synchronized platform profile is hidden from the public marketplace. |

Migration and PPA workflows can add proof fields. Never fabricate, copy between platforms, or hand-edit cryptographic proof material.

## The W3DS workspace

Open a platform repository and select **W3DS**. The page is organized around the platform lifecycle:

1. **Live publication status** reports the publisher's current state and latest result.
2. **What happens next** tracks manifest, permanent identity, application URL, and stable release readiness.
3. **Marketplace visibility** switches the profile between draft and published.
4. **Platform details** edits the display name, description, domains, application URL, and logo URL.
5. **PPA certificate** shows the requirement checklist, signed application, review conversation, and current decision.

Repository or organization permissions control who may edit details, change visibility, apply for PPA, or activate a migration. Read-only visitors see the manifest-backed values without the edit controls.

## Saving changes

Saving through the W3DS workspace creates a normal commit on the default branch. GitW3 checks the last observed commit so it does not silently overwrite a newer manifest change.

For changes made locally:

1. Pull the latest default branch.
2. Edit only supported, non-managed fields.
3. Validate the JSON and domain identifiers.
4. Commit and push normally.
5. Open the **W3DS** tab and watch publication status.

Do not manually change `platformName`, an assigned `ename`, release-controlled `version`, or signed proof fields.

## Identity and publication are asynchronous

After the initial manifest reaches the default branch, GitW3's publisher:

- reserves and publishes the permanent platform eName;
- provisions the platform eVault without an application key;
- writes the assigned eName back to the manifest; and
- synchronizes the platform profile and its visibility.

Repository creation and Git pushes remain available while this happens. Temporary W3DS failures are retried; refresh the **W3DS** tab to see the current state. Repository administrators can see a detailed last error when intervention is required.

The platform eName gets the platform eVault. Version eNames are Registry records for exact releases and do not create additional eVaults.

## Draft versus published

New platforms begin as drafts. A synchronized draft profile is hidden from the marketplace but still belongs to the repository. Use **Publish platform** in the W3DS workspace when the profile is ready to be discoverable; use **Make draft** to hide it again without deleting its stable identity.
