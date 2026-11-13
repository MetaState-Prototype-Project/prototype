---
sidebar_position: 3
title: Create a new platform
description: Create a repository, initial W3DS manifest, and permanent platform identity with GitW3.
---

# Create a new platform

Use **Make a new platform** when the application does not already have a W3DS platform identity. GitW3 creates the repository and initial manifest, then provisions the permanent platform eName asynchronously.

From the **+** menu, select **New repository**, then choose **Make a new platform**.

![The GitW3 choice between making a new platform and porting an existing application.](/img/gitw3/choose-platform-path.png)

## Step 1: Repository

Choose the owner and describe where the code will live:

1. Select your user or an organization as **Owner**.
2. Decide whether the repository is private.
3. Enter the human-facing **Display name**.
4. Confirm the default branch, normally `main`.

![Step one of the create-platform wizard, where the owner and display name are selected.](/img/gitw3/new-platform-repository.png)

You do not choose a repository slug. GitW3 derives a URL-safe repository name and the initial stable `platformName` from the display name. If that name is already used under the owner, GitW3 adds a numeric suffix safely.

The display name can change later. Treat `platformName` as the permanent machine-facing identity; GitW3 will not change it when the friendly name changes.

## Step 2: Platform details

Enter the information W3DS needs to describe the platform:

- **Description:** a concise explanation of what the platform does;
- **Application domains:** one or more domains from the W3DS ontology;
- **Application URL:** the public URL, if the application is already deployed; and
- **Logo URL:** an optional public image URL.

![Step two of the create-platform wizard, with a description, W3DS domains, application URL, and logo URL.](/img/gitw3/new-platform-details.png)

The version is controlled by Git releases, not entered in this form. The initial version is `0.1.0` until a stable semantic release becomes the repository's published version.

You can leave the application URL empty while building. It is required before applying for PPA.

## Step 3: AI setup

Choose whether GitW3 should show the quick install for the W3DS coding-agent skill.

![Step three of the create-platform wizard, offering the W3DS skill command for supported coding agents.](/img/gitw3/new-platform-ai-setup.png)

The command works with supported agents including Codex, Claude Code, Cursor, Copilot, and Windsurf:

```bash
npx skills add MetaState-Prototype-Project/prototype@w3ds
```

Select **Create platform**. GitW3 creates:

- the repository;
- an initial README;
- `.w3ds/platform.json`; and
- the first commit on the default branch.

It does not create or expose a reusable platform private key. The permanent platform identity and its eVault are provisioned automatically without an application or deployment key.

## After creation

The welcome page shows the permanent eName as soon as publication completes. Keep the page open or return to the **W3DS** tab later; provisioning continues in the background.

Next:

1. Clone the repository and push the application code.
2. Open the **W3DS** tab and confirm the manifest and identity status.
3. Add the public application URL when the deployment is reachable.
4. Publish a stable semantic release such as `v0.1.0`.
5. Apply for a PPA certificate for that exact version.
6. Register a deployment from the **Deploy** tab.

See [The platform manifest and W3DS workspace](./platform-manifest-and-workspace) for the generated file and editable fields.
