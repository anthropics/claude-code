# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is the **public GitHub repository** for Claude Code — the CLI/IDE agentic coding tool. The repository serves two main purposes:

1. **Issue tracking** — Bug reports, feature requests, and community discussions for the Claude Code product
2. **Plugins** — A collection of official Claude Code plugins extending functionality with commands, agents, skills, and hooks

The Claude Code binary itself is not in this repository.

## Scripts

Scripts are written in TypeScript and run with [Bun](https://bun.sh). They manage issue lifecycle automation via the GitHub API.

**Running scripts locally:**
```bash
# Dry-run the sweep (stale/autoclose enforcement)
GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY_OWNER=anthropics GITHUB_REPOSITORY_NAME=claude-code bun run scripts/sweep.ts --dry-run

# Dry-run a lifecycle label comment
GITHUB_REPOSITORY=anthropics/claude-code LABEL=needs-info ISSUE_NUMBER=12345 bun run scripts/lifecycle-comment.ts --dry-run
```

**`scripts/gh.sh`** — A security-hardened wrapper around the `gh` CLI used inside Claude-powered workflows. Only allows `issue view`, `issue list`, `search issues`, and `label list` subcommands with a fixed set of flags. Always use this instead of raw `gh` in Claude commands.

**`scripts/edit-issue-labels.sh`** — Adds/removes labels on a GitHub issue:
```bash
./scripts/edit-issue-labels.sh --issue NUMBER --add-label "label1" --remove-label "label2"
```

## Issue Lifecycle System

Issue automation is the main active codebase here. The system has two layers:

### Lifecycle config (`scripts/issue-lifecycle.ts`)
Single source of truth for lifecycle labels, their timeouts (days), and nudge messages. Import from here — don't duplicate values in other scripts.

| Label | Timeout | Behavior |
|-------|---------|----------|
| `invalid` | 3 days | Off-topic issues (Claude API, billing, etc.) |
| `needs-repro` | 7 days | Bugs missing repro steps |
| `needs-info` | 7 days | Bugs missing environment/error details |
| `stale` | 14 days | Inactive issues |
| `autoclose` | 14 days | Legacy drain label |

Issues with 10+ upvotes (`STALE_UPVOTE_THRESHOLD`) are never marked stale or closed.

### Sweep (`scripts/sweep.ts`)
Runs 2x daily via `sweep.yml`. Calls `markStale()` then `closeExpired()`. Safety net in `closeExpired()`: skips closing if a non-bot comment exists after the lifecycle label was applied.

## GitHub Actions Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `claude-issue-triage.yml` | Issue opened / non-bot comment | Runs `/triage-issue` command via `claude-code-action` using `claude-opus-4-6` |
| `claude-dedupe-issues.yml` | Issue opened | Runs `/dedupe` command via `claude-code-action` using `claude-sonnet-4-5` |
| `oncall-triage.yml` | Every 6 hours | Runs `/oncall-triage-ci` to label issues needing oncall attention |
| `sweep.yml` | 2x daily (10:00, 22:00 UTC) | Enforces stale/autoclose timeouts via `bun run scripts/sweep.ts` |
| `issue-lifecycle-comment.yml` | Issue labeled | Posts an explanatory comment when lifecycle labels are applied |
| `non-write-users-check.yml` | — | Guards actions that require write access |

Claude-powered workflows use `anthropics/claude-code-action@v1` and require `ANTHROPIC_API_KEY` secret.

## Claude Commands (`.claude/commands/`)

Commands are markdown files that serve as prompts for Claude in automated workflows:

- **`triage-issue.md`** — Labels issues based on type, area, and lifecycle state. Only uses `gh.sh` and `edit-issue-labels.sh`. Never posts comments.
- **`dedupe.md`** — Searches for and marks duplicate issues.
- **`oncall-triage.md`** / **`oncall-triage-ci.md`** — Identifies critical/blocking issues for oncall attention.
- **`commit-push-pr.md`** — Git workflow automation.

## Plugins (`plugins/`)

Each plugin follows this structure:
```
plugin-name/
├── .claude-plugin/
│   └── plugin.json     # Required manifest (name, version, description)
├── commands/           # Slash commands (.md files)
├── agents/             # Subagent definitions (.md files)
├── skills/             # Skills (subdirs, each with SKILL.md)
├── hooks/
│   └── hooks.json      # Event handler config
└── README.md
```

**Key rules:**
- `.claude-plugin/plugin.json` must exist; component dirs (`commands/`, `agents/`, etc.) must be at plugin root, not inside `.claude-plugin/`
- Skills live at `skills/<skill-name>/SKILL.md` with YAML frontmatter `name:`, `description:`, `version:`
- Use `${CLAUDE_PLUGIN_ROOT}` for portable path references within hook configs

Plugin manifest minimum: `{ "name": "plugin-name" }` in kebab-case.
