# MetaState Skills

Installable AI-agent skills for the MetaState / W3DS ecosystem. Powered by the [skills.sh](https://skills.sh) CLI — works with Claude Code, Codex, Cursor, GitHub Copilot, Windsurf, OpenCode, Cline, Gemini, and 60+ other coding agents.

**[docs.w3ds.metastate.foundation](https://docs.w3ds.metastate.foundation) is authoritative.** These skills are a condensed index of it and can lag behind it — where a skill and the docs disagree, the docs win. Every citation in the skill is a live URL for that reason, and the skill contains no ontology UUIDs: they are resolved from the Ontology service at the time of use.

## Available skills

| Skill | Purpose |
|-------|---------|
| [w3ds](./w3ds) | Web 3 Data Spaces — build post-platforms, call the eVault GraphQL API, wire the Web3 Adapter, implement `w3ds://auth` / `w3ds://sign`, host the platform on GitW3, debug local dev. Enforces eVault-first design: the eVault is the source of truth, the platform DB is a projection, and the platform's own identity lives in its GitW3 repository. |

## Use it without installing anything

Every skill file is published on the docs site, rebuilt on each deploy:

| URL | What |
|-----|------|
| [`/skill/SKILL.md`](https://docs.w3ds.metastate.foundation/skill/SKILL.md) | The skill router |
| [`/skill/reference/`](https://docs.w3ds.metastate.foundation/skill/reference/platform.md) | Reference files, e.g. `platform.md` |
| [`/skill/w3ds-full.txt`](https://docs.w3ds.metastate.foundation/skill/w3ds-full.txt) | The whole skill in one file |
| [`/llms.txt`](https://docs.w3ds.metastate.foundation/llms.txt) | Index of every docs page, with URLs |
| [`/llms-full.txt`](https://docs.w3ds.metastate.foundation/llms-full.txt) | The whole docs corpus in one file |

Any agent that can fetch a URL can self-serve. Installing is still better where the agent supports skills — it then loads on the right questions rather than when someone remembers to paste a link.

## Install

Skills in this directory follow the [skills.sh](https://skills.sh/) `<owner>/<repo>@<skill>` layout.

```bash
npx skills add MetaState-Prototype-Project/prototype@w3ds
```

Auto-detects the agents you have installed and prompts for which to target.

### Common flags

- `-g` — install globally to `~/<agent-dir>/skills/` (default is project-local `./<agent-dir>/skills/`).
- `-a, --agent <name>` — target a specific agent (`claude-code`, `codex`, `cursor`, `copilot`, `windsurf`, `opencode`, etc.).
- `--all` — install to every supported agent detected on your machine.
- `--copy` — copy files instead of symlinking.
- `-y, --yes` — skip confirmation prompts.

### Examples

```bash
# Install globally for Claude Code only
npx skills add MetaState-Prototype-Project/prototype@w3ds -g -a claude-code

# Install for both Cursor and Codex, project-local
npx skills add MetaState-Prototype-Project/prototype@w3ds -a cursor -a codex

# Install for every supported agent on the machine
npx skills add MetaState-Prototype-Project/prototype@w3ds --all -y
```

### Use without installing

```bash
npx skills use MetaState-Prototype-Project/prototype@w3ds | claude
npx skills use MetaState-Prototype-Project/prototype@w3ds --agent cursor
```

Full per-tool install guide (manual paths for agents not yet covered by the CLI, or if you'd rather bypass it) lives at [AI Agent Skill](https://docs.w3ds.metastate.foundation/docs/Post%20Platform%20Guide/ai-agent-skill).

## Local development

To hack on a skill without publishing, symlink it into your agent's skills directory. For Claude Code:

**macOS / Linux:**

```bash
ln -s "$(pwd)/skills/w3ds" ~/.claude/skills/w3ds
```

**Windows (PowerShell, Administrator or Developer Mode):**

```powershell
New-Item -ItemType SymbolicLink `
  -Path   "$HOME\.claude\skills\w3ds" `
  -Target "$PWD\skills\w3ds"
```

Edits to files under `skills/w3ds/` take effect on the next skill invocation — no re-symlink needed. Restart your agent so the new skill is picked up.

## Authoring notes

Each skill is a directory with a top-level `SKILL.md` and optional `reference/` files. The `SKILL.md` frontmatter needs at minimum a `name` and a `description`; the description is what the agent uses to decide when to trigger the skill, so list the concrete surfaces it covers (concepts, APIs, protocol names, common questions).

Keep the main `SKILL.md` scannable (~150 lines) and push deep content into `reference/*.md` files that get loaded on demand.

Two rules specific to these skills:

- **Cite live URLs, never repo paths.** A skill is installed outside this repo far more often than inside it, so `docs/docs/...` is a dead end for most readers.
- **No ontology UUIDs.** They go stale, and an agent will copy one rather than resolve it. Teach the `GET /schemas` lookup instead.
