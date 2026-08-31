---
sidebar_position: 5
title: Work with repositories
description: Clone, push, collaborate, and publish releases in a GitW3 repository.
---

# Work with repositories

A GitW3 repository supports the familiar Git forge workflow: clone, branch, commit, push, review pull requests, track issues, tag versions, and publish releases. Platform repositories add **W3DS** and **Deploy** tabs to that workflow.

## Clone a repository

Open the repository and copy the exact URL from its **HTTP** or **SSH** clone control.

### SSH

Add your public SSH key under **User settings → SSH / GPG Keys**, then:

```bash
git clone <ssh-url-copied-from-gitw3>
cd <repository-directory>
```

SSH is the easiest option for regular development because Git can authenticate with your local agent.

### HTTPS

Create a personal access token under **User settings → Applications**, then:

```bash
git clone <https-url-copied-from-gitw3>
```

When prompted, use your GitW3 account name as the username and the personal access token as the password. Store it in an operating-system credential manager rather than in a remote URL or shell script.

The `@` displayed before eNames in the UI is cosmetic. Always use the owner and repository coordinates from the clone control exactly as shown.

## Use an existing local checkout

Inspect the current state before changing remotes:

```bash
git status
git branch --show-current
git remote -v
```

To preserve an old `origin` and make GitW3 the new one:

```bash
git remote rename origin upstream
git remote add origin <clone-url-copied-from-gitw3>
git push -u origin HEAD:main
```

Change `main` if the GitW3 repository uses another default branch. If this is an existing W3DS application, follow the complete [guided port flow](./port-an-existing-application) instead of treating the remote change as the entire migration.

## Day-to-day collaboration

A typical change uses a short-lived branch and a pull request:

```bash
git switch -c feat/my-change
# edit and test
git add <files>
git commit -m "feat: describe the change"
git push -u origin feat/my-change
```

Then open **Pull requests → New pull request**, choose the source and target branches, review the diff, and request review. Repository permissions and branch protection determine who can push or merge.

Use:

- **Issues** for bugs, tasks, and discussion;
- **Pull requests** for reviewable branch changes;
- **Actions** for configured automation and checks;
- **Packages** for artifacts supported by the repository; and
- **Releases** to publish stable platform versions.

## Platform-specific tabs

- **W3DS** shows live publication status, identity readiness, manifest details, visibility, PPA state, and any staged migration.
- **Deploy** creates signed W3DS records for a PPA-certified release. It does not run the application's hosting pipeline.

Edits made in the **W3DS** tab commit `.w3ds/platform.json` to the default branch. Pull before making related local changes so that you do not accidentally create competing manifest edits.

## Publish a stable release

GitW3 takes the platform version from the latest published stable release. Use a semantic version tag such as `v1.2.3`:

```bash
git switch main
git pull --ff-only
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

Then open **Releases → New release**, select the tag, add release notes, and publish it as a stable release. Drafts, prereleases, and non-semantic tags do not satisfy the W3DS stable-release requirement.

GitW3 normalizes a leading `v`, so `v1.2.3` becomes manifest version `1.2.3`. See [Releases and PPA certification](./releases-and-ppa) before applying for certification.

## Credentials and safe automation

- Give personal access tokens the smallest useful scope and rotate them periodically.
- Use deploy keys or a dedicated service identity for repository automation instead of a person's broad token where possible.
- Never commit wallet secrets, migration tokens, personal access tokens, or `w3ds-deployment-key.json`.
- Protect the default branch and require checks for repositories that publish production platforms.
