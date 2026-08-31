---
sidebar_position: 8
---

# AI Agent Skill

This repo ships a packaged **W3DS knowledge skill** under `skills/w3ds/` that you can load into your AI coding assistant so it stops guessing ontology UUIDs, mapping directives, and GraphQL field names. It's grounded in the docs you're reading now.

## Zero install

If your agent can fetch a URL, it needs nothing installed. Point it at:

```text
https://docs.w3ds.metastate.foundation/skill/SKILL.md
```

Or hand it the whole skill in one file:

```text
https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt
```

Two companions are published alongside it, and an agent that can fetch should know about both:

| File | What it is |
| --- | --- |
| [`/llms.txt`](https://docs.w3ds.metastate.foundation/llms.txt) | An index of every page on this site, with URLs and one-line summaries. The cheapest way for an agent to find the authoritative page for a question. |
| [`/llms-full.txt`](https://docs.w3ds.metastate.foundation/llms-full.txt) | The whole documentation corpus in a single file, for agents that would rather read everything once. |

These are regenerated on every docs deploy, so a fetch is always current. Installing is still worth it for agents that support skills — the skill then loads automatically on the right questions, instead of only when someone remembers to paste a URL.

The easiest install for every supported agent is the [`npx skills`](https://skills.sh) CLI — it targets Claude Code, Codex, Cursor, GitHub Copilot, Windsurf, OpenCode, Cline, Gemini, and 60+ others. Manual per-tool instructions are further down if you'd rather bypass the CLI or your agent isn't supported yet.

:::note Windows users

Command blocks are labeled **macOS / Linux (bash)** and **Windows (PowerShell)** where they differ. If you use **WSL** or **Git Bash**, the bash commands work verbatim — skip the PowerShell variants.

- Paths written `~/.foo/bar` also work in PowerShell (`~` resolves to `$HOME` = `%USERPROFILE%`).
- Symlinks on Windows require either an **Administrator** PowerShell session **or** [Developer Mode](https://learn.microsoft.com/en-us/windows/apps/get-started/developer-mode-features-and-debugging) enabled in Settings.
- Forward slashes in paths are accepted by `npx`, `node`, `aider`, and most cross-platform CLIs on Windows — only PowerShell-native cmdlets prefer backslashes.

:::

## What the skill enforces

The skill is not only a reference. It changes how an agent behaves on W3DS work:

- **The eVault is the source of truth.** The platform database is a projection of it. The skill applies the reconstructability test — *if this database were dropped and rebuilt by replaying the relevant eVaults, what would be lost?* — before agreeing to persist anything new. See [Data Ownership Rules](/docs/W3DS%20Basics/Data-Ownership-Rules).
- **Resolve, never recall.** Ontology IDs, endpoints, GraphQL field names and ACL verbs are looked up at the time of use. The skill deliberately contains no ontology UUIDs, so there is nothing stale to copy. Where it cannot verify something — no fetch tool, or the service is unreachable — it says so and marks the spot in code rather than substituting a plausible value.
- **Two hard stops.** The agent stops and asks, rather than writing code, when a design would make the local database authoritative for user data, or when a persisted entity type has no ontology. The second is a path rather than a wall: ontologies are ordinary JSON files, and the agent will draft the schema and offer to open the PR. See [Proposing a new ontology](/docs/Infrastructure/Ontology#proposing-a-new-ontology).
- **A platform belongs in a GitW3 repository.** The same instinct one layer up: the repository is the source of truth for the platform metadata W3DS publishes. The skill raises this early rather than after the application is wired to another forge, knows that a plain repository import is not the guided port flow, and refuses to hand-edit managed `.w3ds/platform.json` fields, fabricate a proof, or commit `w3ds-deployment-key.json`. See [GitW3](/docs/GitW3/overview).
- **A definition of done.** `X-ENAME` on every call, `handleChange` on every write path, an idempotent webhook controller, no invented identifiers.

If you want an agent that produces a conventional application with sync bolted on, do not install this skill. That is the outcome it exists to prevent.

## What's in the skill

- `SKILL.md` — router, authority rules, pre-flight gate, stop rules, definition of done
- `reference/w3ds-native.md` — where data lives: the reconstructability test, anti-patterns, proposing an ontology
- `reference/evault.md` — GraphQL API, ACLs, `/whois`, `/logs`
- `reference/identity.md` — W3ID, eName, Binding Documents
- `reference/registry.md` — Registry endpoints, canonical ontology UUIDs
- `reference/protocols.md` — `w3ds://auth`, `w3ds://sign`, Awareness Protocol, signature formats, `w3ds://file`
- `reference/platform.md` — building a post-platform (auth, webhook, mapping directives, Web3 Adapter)
- `reference/wallet.md` — eID Wallet, wallet-sdk, key delegation
- `reference/gitw3.md` — GitW3: the platform manifest, platform / version / deployment eNames, PPA, porting an existing app
- `reference/dev-setup.md` — `pnpm dev:core` + debugging playbook

Everything in it cites this site by URL, so an agent that gets stuck has somewhere authoritative to go. Where the skill and these docs disagree, the docs win.

## Install with `npx skills` (all tools)

The [skills CLI](https://skills.sh) auto-detects the AI coding agents you have installed and configures each of them. Works cross-platform (macOS / Linux / Windows PowerShell / WSL).

### Recommended

```bash
npx skills add MetaState-Prototype-Project/prototype@w3ds
```

The CLI detects your installed agents and prompts for which to target. Default install is **project-local** (committed with your project, shared with your team); pass `-g` for a global install.

### Pick a specific tool

Skip the prompt with `-a, --agent`:

```bash
# Claude Code
npx skills add MetaState-Prototype-Project/prototype@w3ds -a claude-code

# OpenAI Codex CLI
npx skills add MetaState-Prototype-Project/prototype@w3ds -a codex

# Cursor
npx skills add MetaState-Prototype-Project/prototype@w3ds -a cursor

# GitHub Copilot
npx skills add MetaState-Prototype-Project/prototype@w3ds -a copilot

# Windsurf
npx skills add MetaState-Prototype-Project/prototype@w3ds -a windsurf

# OpenCode
npx skills add MetaState-Prototype-Project/prototype@w3ds -a opencode

# Every supported agent installed on your machine
npx skills add MetaState-Prototype-Project/prototype@w3ds --all
```

Full agent list at [skills.sh](https://skills.sh) (Gemini, Cline, Roo, Zed, Goose, Kilo, VS Code, etc. are all supported).

### Common flags

- `-g` — install globally to `~/<agent-dir>/skills/` (default: project-local `./<agent-dir>/skills/`).
- `-a, --agent <name>` — target one or more specific agents (repeatable / space-separated).
- `--all` — install to every supported agent detected on your machine.
- `--copy` — copy files instead of symlinking.
- `-y, --yes` — skip confirmation prompts.

### Use without installing

Load the skill into a single session without touching your filesystem:

```bash
# Pipe the generated prompt into your agent
npx skills use MetaState-Prototype-Project/prototype@w3ds | claude

# Or start any supported agent interactively with the skill loaded
npx skills use MetaState-Prototype-Project/prototype@w3ds --agent cursor
```

## Claude Code (manual)

If you'd rather not use the CLI, or you want to hack on the skill locally:

### Option A — symlink from a local clone

If you already have the metastate repo checked out:

**macOS / Linux (bash):**

```bash
ln -s "$(pwd)/skills/w3ds" ~/.claude/skills/w3ds
```

**Windows (PowerShell, Administrator or Developer Mode):**

```powershell
New-Item -ItemType SymbolicLink `
  -Path   "$HOME\.claude\skills\w3ds" `
  -Target "$PWD\skills\w3ds"
```

Edits under `skills/w3ds/` take effect on the next skill invocation — no re-symlink.

### Option B — project-scoped `CLAUDE.md`

Add a line to your project's `CLAUDE.md`:

```markdown
When working on W3DS code, load `skills/w3ds/SKILL.md` from the metastate repo (or the installed skill) before answering.
```

Restart Claude Code after any install method. Verify with a question like *"how do I write a webhook controller for a W3DS post-platform?"* — the skill should be picked up.

## OpenAI Codex CLI (manual)

Simplest install is `npx skills add MetaState-Prototype-Project/prototype@w3ds -a codex` from the section above. Everything below is for when you want to author `AGENTS.md` by hand.

Codex CLI reads `AGENTS.md` from the repo root and `~/.codex/AGENTS.md` for user-level context.

### Project-scoped

Write the published skill into `AGENTS.md` at the root of the project you're building on W3DS. No clone needed.

**macOS / Linux (bash):**

```bash
curl -fsSL https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt > AGENTS.md
```

**Windows (PowerShell):**

```powershell
Invoke-WebRequest https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt -OutFile AGENTS.md
```

If `AGENTS.md` already exists, append instead of overwriting:

**macOS / Linux (bash):**

```bash
printf '\n\n# W3DS reference\n\n' >> AGENTS.md
curl -fsSL https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt >> AGENTS.md
```

**Windows (PowerShell):**

```powershell
Add-Content AGENTS.md "`n`n# W3DS reference`n"
(Invoke-WebRequest https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt).Content |
  Add-Content AGENTS.md
```

Working from a metastate clone instead? Concatenate the local files:

```bash
cat skills/w3ds/SKILL.md skills/w3ds/reference/*.md > AGENTS.md
```

### User-scoped

Put the same content in `~/.codex/AGENTS.md` if you want it available in every project you touch.

## Cursor (manual)

Simplest install is `npx skills add MetaState-Prototype-Project/prototype@w3ds -a cursor` from the section above. Everything below is for when you want a hand-tuned `.mdc` file.

Cursor uses `.cursor/rules/*.mdc` files. Each rule file has YAML frontmatter controlling when it activates.

Create `.cursor/rules/w3ds.mdc`:

```mdc
---
description: W3DS (Web 3 Data Spaces) knowledge — eVault GraphQL, Web3 Adapter, w3ds://auth, w3ds://sign, mapping directives, ontology UUIDs
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/mapping*.json"
  - "**/AGENTS.md"
alwaysApply: false
---

<paste contents of skills/w3ds/SKILL.md here>

---

<paste contents of skills/w3ds/reference/*.md here, each under a section header>
```

Or generate it.

**macOS / Linux (bash):**

```bash
mkdir -p .cursor/rules
{
  echo '---'
  echo 'description: W3DS (Web 3 Data Spaces) knowledge — eVault GraphQL, Web3 Adapter, w3ds://auth, w3ds://sign, mapping directives, ontology UUIDs'
  echo 'globs:'
  echo '  - "**/*.ts"'
  echo '  - "**/*.tsx"'
  echo '  - "**/mapping*.json"'
  echo 'alwaysApply: false'
  echo '---'
  echo
  tail -n +6 skills/w3ds/SKILL.md
  echo
  for f in skills/w3ds/reference/*.md; do
    echo -e "\n---\n\n# $(basename "$f" .md)\n"
    cat "$f"
  done
} > .cursor/rules/w3ds.mdc
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force -Path .cursor/rules | Out-Null
$out = '.cursor/rules/w3ds.mdc'

@'
---
description: W3DS (Web 3 Data Spaces) knowledge — eVault GraphQL, Web3 Adapter, w3ds://auth, w3ds://sign, mapping directives, ontology UUIDs
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/mapping*.json"
alwaysApply: false
---

'@ | Set-Content $out

Get-Content skills/w3ds/SKILL.md | Select-Object -Skip 5 | Add-Content $out
Get-ChildItem skills/w3ds/reference/*.md | ForEach-Object {
  Add-Content $out "`n---`n`n# $($_.BaseName)`n"
  Get-Content $_.FullName | Add-Content $out
}
```

Set `alwaysApply: true` if you want the rule loaded for every request instead of matching on globs.

## GitHub Copilot (manual)

Simplest install is `npx skills add MetaState-Prototype-Project/prototype@w3ds -a copilot` from the section above. Everything below is for when you want to write `.github/copilot-instructions.md` yourself.

Copilot reads `.github/copilot-instructions.md` for repo-level guidance.

**macOS / Linux (bash):**

```bash
mkdir -p .github
curl -fsSL https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt \
  > .github/copilot-instructions.md
```

**Windows (PowerShell):**

```powershell
New-Item -ItemType Directory -Force -Path .github | Out-Null
Invoke-WebRequest https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt `
  -OutFile .github/copilot-instructions.md
```

Copilot has no fetch tool of its own, so this copy is all it will ever see. Re-run the command when the docs change, and expect the skill to flag identifiers it could not verify rather than resolving them itself.

Commit the file. Copilot picks it up automatically for repositories that have it enabled in settings (Copilot → Chat → *Instructions*).

## Windsurf (manual)

Simplest install is `npx skills add MetaState-Prototype-Project/prototype@w3ds -a windsurf` from the section above. Everything below is for when you want to write `.windsurfrules` yourself.

Windsurf reads `.windsurfrules` at the repo root.

**macOS / Linux (bash):**

```bash
curl -fsSL https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt > .windsurfrules
```

**Windows (PowerShell):**

```powershell
Invoke-WebRequest https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt `
  -OutFile .windsurfrules
```

For user-level rules, put the same content in:
- macOS / Linux: `~/.codeium/windsurf/memories/global_rules.md`
- Windows: `$HOME\.codeium\windsurf\memories\global_rules.md`

## Aider

Aider doesn't auto-load a file, but you can pin it:

```bash
aider --read skills/w3ds/SKILL.md \
      --read skills/w3ds/reference/platform.md \
      --read skills/w3ds/reference/evault.md
```

For long-running sessions, drop everything into `CONVENTIONS.md` and start Aider with:

```bash
aider --read CONVENTIONS.md
```

## Continue.dev, Cline, Roo, and others

Cline, Roo, Continue.dev, Gemini, Zed, Goose, Kilo, and dozens more are all supported by `npx skills` — try `-a <name>` from the [main install section](#install-with-npx-skills-all-tools) first. If your agent isn't supported yet or you want to bypass the CLI, use this universal pattern:

1. Download the skill as one markdown file.

   **macOS / Linux (bash):**

   ```bash
   curl -fsSL https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt > w3ds-context.md
   ```

   **Windows (PowerShell):**

   ```powershell
   Invoke-WebRequest https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt `
     -OutFile w3ds-context.md
   ```

2. Add `w3ds-context.md` to whatever the agent uses for repo-level context:
   - **Continue.dev** — reference it in `.continue/context/` or attach with `@Files`.
   - **Cline** — put in `.clinerules` or `.clinerules-*`.
   - **Roo** — same as Cline (`.clinerules`).
   - **Anything else** — most agents accept a system prompt or a "read this file" flag. Point at `w3ds-context.md`.

## Any tool — the pattern

If your tool isn't listed above, the pattern is always the same:

1. Put `https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt` into whatever file the tool reads for repo instructions.
2. If the tool supports rule-file frontmatter (Cursor, some others), keep it descriptive so the tool knows when to activate the rule.
3. If the tool has no rule system at all, point it at the URL in your prompt: *"Read https://docs.w3ds.metastate.foundation/skill/SKILL.md and treat https://docs.w3ds.metastate.foundation as the authoritative source before answering."*

## Updating

The skill mirrors the docs. When docs change, pull the latest metastate `main` and:

- **`npx skills` install (any agent):** `npx skills update` — updates every installed skill across every agent.
- **Symlink install (Claude Code):** nothing — edits take effect immediately.
- **Manual copy install (Cursor, Copilot, Windsurf, Codex, Aider):** re-run the download command from the relevant section above. `/skill/w3ds-full.txt` is rebuilt on every docs deploy, so a re-fetch is always current.

If you're building on a fork and shipping the manual copy, add a repo hook or pre-commit step that re-runs the concatenation so the copy in your project stays fresh.

## Contributing

Gaps or wrong answers? PRs welcome. The skill lives at `skills/w3ds/` in this repo. Rules of thumb:

- Ground every claim in a `https://docs.w3ds.metastate.foundation/docs/...` URL. The skill is installed outside this repo far more often than inside it, so a repo-relative path is a dead end for most readers.
- **No ontology UUIDs in the skill.** They go stale, and an agent will copy one rather than resolve it. Teach the lookup instead.
- Keep the main `SKILL.md` scannable (under ~200 lines); push detail into `reference/*.md`.
- Don't invent APIs. If the docs don't say it, don't put it in the skill — add it to the docs first.
- If a change alters what the agent *does* rather than what it knows, say so in [What the skill enforces](#what-the-skill-enforces).

## Reference

- Skill source: [`skills/w3ds/`](https://github.com/MetaState-Prototype-Project/prototype/tree/main/skills/w3ds) in the metastate repo.
- Distribution readme: [`skills/README.md`](https://github.com/MetaState-Prototype-Project/prototype/tree/main/skills).
