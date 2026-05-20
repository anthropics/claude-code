# Claude Code Plugin Repository

**This repository does not contain the Claude Code CLI source code.** The CLI is
closed-source, distributed as prebuilt binaries via `curl`, `brew`, `winget`, and
(deprecated) npm. This repo exists to host the plugin ecosystem, example
configurations, the changelog, the issue tracker, and the security policy.

The actual contents are example plugins, configuration templates, and GitHub
automation scripts. There is no root-level `package.json`, no build step, and no
application entry point.

## Repository Layout

```text
plugins/             13 example plugins (the core of this repo)
scripts/             GitHub issue automation (Bun/TypeScript)
examples/settings/   Claude Code settings templates (lax, strict, sandboxed)
.claude-plugin/      Marketplace manifest (marketplace.json)
Script/              DevContainer helper (PowerShell)
CHANGELOG.md         Release notes for the closed-source CLI
```

## Plugin Architecture

Plugins combine four composable abstractions:

| Abstraction | Location | Format | Trigger |
|---|---|---|---|
| **Commands** | `commands/*.md` | YAML frontmatter + markdown body | User types `/command-name` |
| **Agents** | `agents/*.md` | YAML frontmatter + system prompt | Auto-matched via `<example>` blocks in description |
| **Skills** | `skills/skill-name/SKILL.md` | YAML frontmatter + progressive disclosure | Auto-loaded when trigger phrases appear |
| **Hooks** | `hooks/hooks.json` + scripts | JSON config pointing to executables | Fired on events: PreToolUse, PostToolUse, SessionStart, SessionEnd, Stop, SubagentStop, UserPromptSubmit, PreCompact, Notification |

All abstractions are optional — a plugin can contain any combination.

## Standard Plugin Structure

```text
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # name, description, version, author
├── commands/                # Slash commands (markdown)
├── agents/                  # Autonomous agents (markdown)
├── skills/                  # Knowledge systems (SKILL.md + references/)
│   └── skill-name/
│       ├── SKILL.md
│       ├── references/
│       └── examples/
├── hooks/                   # Event handlers
│   ├── hooks.json           # Hook configuration
│   └── *.py / *.sh          # Hook implementations
├── .mcp.json                # MCP server config (optional)
└── README.md
```

## Key Conventions

### Frontmatter

Commands and agents use YAML frontmatter:

```yaml
---
description: What this command/agent does
allowed-tools: ["Read", "Bash(git add:*)"]  # Granular tool access
argument-hint: "[project-name]"              # Commands only
model: sonnet                                # Agents only (haiku|sonnet|opus)
---
```

Skills use frontmatter in SKILL.md:

```yaml
---
name: Skill Name
description: Trigger phrases that auto-load this skill
version: 0.2.0
---
```

### Hooks

Hook scripts communicate via JSON on stdin/stdout. Key patterns:

- **Blocking** (PreToolUse): Output `{"allowOperation": false, "message": "reason"}`
- **Injecting context** (SessionStart): Output `{"hookSpecificOutput": {"additionalContext": "..."}}`
- **Exit codes**: Non-zero exit blocks the operation

Use `${CLAUDE_PLUGIN_ROOT}` in `hooks.json` for portable paths to scripts.

### Tool Restrictions

Commands restrict available tools via `allowed-tools` frontmatter. Supports
patterns like `Bash(git commit:*)` to allow only specific subcommands.

## Scripts

GitHub issue automation in `scripts/` uses **Bun** (`#!/usr/bin/env bun`):

- `sweep.ts` — Issue lifecycle automation
- `auto-close-duplicates.ts` — Duplicate issue management
- `issue-lifecycle.ts` — Issue state transitions
- `lifecycle-comment.ts` — Comment templates
- `backfill-duplicate-comments.ts` — Backfill comments on duplicates
- `comment-on-duplicates.sh` — Shell wrapper for duplicate commenting

## Configuration Examples

`examples/settings/` contains three templates:

- **settings-lax.json** — Minimal restrictions, plugins enabled
- **settings-strict.json** — Enterprise lockdown: denies WebFetch/WebSearch, managed hooks/permissions only
- **settings-bash-sandbox.json** — Containerized bash with network restrictions

## Contributing

From `plugins/README.md`:

1. Follow the standard plugin structure above
2. Include a comprehensive `README.md`
3. Add plugin metadata in `.claude-plugin/plugin.json`
4. Document all commands and agents with usage examples
5. For marketplace listing: add an entry to `.claude-plugin/marketplace.json`
