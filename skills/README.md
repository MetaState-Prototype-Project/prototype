# MetaState Skills

Installable AI-agent skills for the MetaState / W3DS ecosystem. Powered by the [skills.sh](https://skills.sh) CLI — works with Claude Code, Codex, Cursor, GitHub Copilot, Windsurf, OpenCode, Cline, Gemini, and 60+ other coding agents.

## Available skills

| Skill | Purpose |
|-------|---------|
| [w3ds](./w3ds) | Web 3 Data Spaces — build post-platforms, call the eVault GraphQL API, wire the Web3 Adapter, implement `w3ds://auth` / `w3ds://sign`, debug local dev. |

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

Full per-tool install guide (manual paths for agents not yet covered by the CLI, or if you'd rather bypass it) lives at [docs/Post Platform Guide/AI Agent Skill](../docs/docs/Post%20Platform%20Guide/ai-agent-skill.md).

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
