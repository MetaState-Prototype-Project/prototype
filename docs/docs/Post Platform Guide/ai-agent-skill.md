---
sidebar_position: 7
---

# AI Agent Skill (Claude Code, Codex, Cursor, Copilot, Windsurf, Aider)

This repo ships a packaged **W3DS knowledge skill** under `skills/w3ds/` that you can load into your AI coding assistant so it stops guessing ontology UUIDs, mapping directives, and GraphQL field names. It's grounded in the docs you're reading now.

Every agent tool has its own convention for repo-level context (skills, rules, `AGENTS.md`, `.cursorrules`, etc.). Install instructions below cover the ones people actually use. Pick your tool — or copy the fallback pattern for anything else.

## What's in the skill

- `SKILL.md` — router and ecosystem map
- `reference/evault.md` — GraphQL API, ACLs, `/whois`, `/logs`
- `reference/identity.md` — W3ID, eName, Binding Documents
- `reference/registry.md` — Registry endpoints, canonical ontology UUIDs
- `reference/protocols.md` — `w3ds://auth`, `w3ds://sign`, Awareness Protocol, signature formats, `w3ds://file`
- `reference/platform.md` — building a post-platform (auth, webhook, mapping directives, Web3 Adapter)
- `reference/wallet.md` — eID Wallet, wallet-sdk, key delegation
- `reference/dev-setup.md` — `pnpm dev:core` + debugging playbook

## Claude Code

### Option A — skills CLI (recommended)

```bash
npx skills add MetaState-Prototype-Project/prototype@w3ds -g -y
```

`-g` installs globally to `~/.claude/skills/`. Drop `-g` for a project-local install.

### Option B — symlink from a local clone

If you already have the metastate repo checked out:

```bash
ln -s "$(pwd)/skills/w3ds" ~/.claude/skills/w3ds
```

Edits under `skills/w3ds/` take effect on the next skill invocation — no re-symlink.

### Option C — project-scoped `CLAUDE.md`

Add a line to your project's `CLAUDE.md`:

```markdown
When working on W3DS code, load `skills/w3ds/SKILL.md` from the metastate repo (or the installed skill) before answering.
```

Restart Claude Code after any install method. Verify with a question like *"how do I write a webhook controller for a W3DS post-platform?"* — the skill should be picked up.

## OpenAI Codex CLI (`AGENTS.md`)

Codex CLI reads `AGENTS.md` from the repo root and `~/.codex/AGENTS.md` for user-level context.

### Project-scoped

Copy the skill content into `AGENTS.md` at the root of the project you're building on W3DS:

```bash
cat skills/w3ds/SKILL.md > AGENTS.md
echo -e "\n\n---\n" >> AGENTS.md
for f in skills/w3ds/reference/*.md; do
  echo -e "\n## $(basename "$f" .md)\n" >> AGENTS.md
  cat "$f" >> AGENTS.md
done
```

Or, if `AGENTS.md` already exists, append the skill as a section:

```bash
echo -e "\n\n# W3DS reference\n" >> AGENTS.md
cat skills/w3ds/SKILL.md skills/w3ds/reference/*.md >> AGENTS.md
```

### User-scoped

Put the same concatenated content in `~/.codex/AGENTS.md` if you want it available in every project you touch.

## Cursor (`.cursor/rules/`)

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

Or generate it with:

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

Set `alwaysApply: true` if you want the rule loaded for every request instead of matching on globs.

## GitHub Copilot (`.github/copilot-instructions.md`)

Copilot reads `.github/copilot-instructions.md` for repo-level guidance.

```bash
mkdir -p .github
cat skills/w3ds/SKILL.md skills/w3ds/reference/*.md > .github/copilot-instructions.md
```

Commit the file. Copilot picks it up automatically for repositories that have it enabled in settings (Copilot → Chat → *Instructions*).

## Windsurf (`.windsurfrules`)

Windsurf reads `.windsurfrules` at the repo root:

```bash
cat skills/w3ds/SKILL.md skills/w3ds/reference/*.md > .windsurfrules
```

For user-level rules, put the same content in `~/.codeium/windsurf/memories/global_rules.md`.

## Aider (`CONVENTIONS.md` + `--read`)

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

These agents accept some form of system-prompt or context-injection. The simplest universal pattern:

1. Concatenate the skill into one markdown file:

   ```bash
   cat skills/w3ds/SKILL.md skills/w3ds/reference/*.md > w3ds-context.md
   ```

2. Add `w3ds-context.md` to whatever the agent uses for repo-level context:
   - **Continue.dev** — reference it in `.continue/context/` or attach with `@Files`.
   - **Cline** — put in `.clinerules` or `.clinerules-*`.
   - **Roo** — same as Cline (`.clinerules`).
   - **Anything else** — most agents accept a system prompt or a "read this file" flag. Point at `w3ds-context.md`.

## Any tool — the pattern

If your tool isn't listed above, the pattern is always the same:

1. Concatenate `skills/w3ds/SKILL.md` and `skills/w3ds/reference/*.md` into whatever file the tool reads for repo instructions.
2. If the tool supports rule-file frontmatter (Cursor, some others), keep it descriptive so the tool knows when to activate the rule.
3. If the tool has no rule system at all, point it at the skill in your prompt: *"Use `skills/w3ds/` in this repo as authoritative W3DS reference before answering."*

## Updating

The skill mirrors the docs. When docs change, pull the latest metastate `main` and:

- **Claude Code (skills CLI):** `npx skills update`
- **Claude Code (symlink):** nothing — edits take effect immediately.
- **Copy-based installs (Cursor, Copilot, Windsurf, Codex, Aider):** re-run the concatenation command from the section above.

If you're building on a fork, add a repo hook or a pre-commit step that re-runs the concatenation so the copy in your project stays fresh.

## Contributing

Gaps or wrong answers? PRs welcome. The skill lives at `skills/w3ds/` in this repo. Rules of thumb:

- Ground every claim in a `docs/docs/...` path.
- Keep the main `SKILL.md` scannable (under ~200 lines); push detail into `reference/*.md`.
- Don't invent APIs. If the docs don't say it, don't put it in the skill.

## Reference

- Skill source: [`skills/w3ds/`](https://github.com/MetaState-Prototype-Project/prototype/tree/main/skills/w3ds) in the metastate repo.
- Distribution readme: [`skills/README.md`](https://github.com/MetaState-Prototype-Project/prototype/tree/main/skills).
