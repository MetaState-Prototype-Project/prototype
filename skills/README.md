# MetaState Skills

Installable Claude Code skills for the MetaState / W3DS ecosystem.

## Available skills

| Skill | Purpose |
|-------|---------|
| [w3ds](./w3ds) | Web 3 Data Spaces — build post-platforms, call the eVault GraphQL API, wire the Web3 Adapter, implement `w3ds://auth` / `w3ds://sign`, debug local dev. |

## Install

Skills in this directory follow the [skills.sh](https://skills.sh/) `<owner>/<repo>@<skill>` layout and are installable via the `skills` CLI:

```bash
npx skills add MetaState-Prototype-Project/prototype@w3ds -g -y
```

`-g` installs into `~/.claude/skills/`. Omit for a project-local install.

## Local development

To hack on a skill without publishing, symlink it into the Claude skills directory:

```bash
ln -s "$(pwd)/skills/w3ds" ~/.claude/skills/w3ds
```

Restart Claude Code so the new skill is picked up. Edits to files under `skills/w3ds/` take effect immediately on the next skill invocation — no re-symlink needed.

## Authoring notes

Each skill is a directory with a top-level `SKILL.md` and optional `reference/` files. The `SKILL.md` frontmatter needs at minimum a `name` and a `description`; the description is what Claude uses to decide when to trigger the skill, so it should list the concrete surfaces the skill covers (concepts, APIs, protocol names, common questions).

Keep the main `SKILL.md` scannable (~150 lines) and push deep content into `reference/*.md` files that get loaded on demand.
