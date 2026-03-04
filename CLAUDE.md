# CLAUDE.md — Claude Code Repository Guide

This file provides guidance for AI assistants working in this repository.

## Project Overview

This repository is the **official Anthropic plugin marketplace** for [Claude Code](https://docs.anthropic.com/en/docs/claude-code/overview) — an agentic coding CLI tool. This repo does **not** contain the CLI source code; it contains:

- 7 official plugins extending Claude Code with custom commands, agents, and hooks
- Example hook implementations for developers
- GitHub automation scripts for issue management
- CI/CD workflows powering automated issue triage and `@claude` integration

**Claude Code CLI install**: `npm install -g @anthropic-ai/claude-code` (requires Node.js 18+)

## Repository Structure

```
/
├── plugins/             # 7 official Claude Code plugins
├── examples/            # Example hook implementations for developers
├── scripts/             # GitHub automation utilities (TypeScript, Bun runtime)
├── .github/             # GitHub Actions workflows and issue templates
├── .claude/             # Project-level internal slash commands
├── .claude-plugin/      # Plugin marketplace registry (marketplace.json)
├── README.md            # Project overview and quick start
└── CHANGELOG.md         # Version history
```

## Plugin System Architecture

### Plugin Directory Structure

Each plugin in `plugins/` follows this layout:

```
plugins/plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (name, version, author, description)
├── commands/                # Slash commands (*.md files)
├── agents/                  # Specialized agents (*.md files)
├── hooks/                   # Hook configurations and scripts
│   ├── hooks.json           # Hook registration (event types and matchers)
│   └── *.py                 # Hook implementation scripts
└── README.md                # Plugin documentation
```

### Slash Command File Format

Commands in `commands/` are YAML-frontmatter markdown files:

```markdown
---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a git commit
argument-hint: optional description
---

## Context

- Current git status: !`git status`
- Recent commits: !`git log --oneline -10`

## Your task

[Task instructions for Claude]
```

Key frontmatter fields:
- `allowed-tools` — Explicit tool allowlist (security model; prefer specific over broad)
- `description` — Shown in the `/` command menu
- `argument-hint` — Optional hint displayed when typing the command
- Lines starting with `!` followed by a backtick block inject live command output into context

### Agent File Format

Agents in `agents/` are YAML-frontmatter markdown files:

```markdown
---
name: agent-name
description: What this agent does
tools: Read, Glob, Grep, Bash
model: claude-sonnet-4-5
color: green
---

[Agent system prompt and behavioral instructions]
```

Key frontmatter fields:
- `tools` — Comma-separated list of allowed tools
- `model` — Claude model to use (Sonnet for most; Haiku for fast/simple tasks)
- `color` — Terminal output color for visual identification

### Hook System

**Hook types:**
- `PreToolUse` — Runs before a tool call; exit code 2 blocks execution (stderr shown to Claude)
- `PostToolUse` — Runs after a tool call completes
- `SessionStart` — Runs at session start to inject additional context

**Exit codes for PreToolUse hooks:**
- `0` — Allow tool to proceed
- `1` — Show stderr to the user but do not block
- `2` — Block tool execution and show stderr to Claude

**Hook registration** (`hooks/hooks.json`):
```json
{
  "description": "Hook description",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/my_hook.py"
          }
        ]
      }
    ]
  }
}
```

Use `${CLAUDE_PLUGIN_ROOT}` for paths relative to the plugin directory.

Hook implementations receive a JSON payload on stdin with `tool_name`, `tool_input`, and `session_id`.

## Available Plugins

| Plugin | Command(s) | Agents | Purpose |
|--------|-----------|--------|---------|
| `commit-commands` | `/commit`, `/commit-push-pr`, `/clean_gone` | — | Git workflow automation |
| `feature-dev` | `/feature-dev` | code-explorer, code-architect, code-reviewer | Structured 7-phase feature development |
| `code-review` | `/code-review` | — (4 inline parallel agents) | Automated PR review with confidence scoring |
| `pr-review-toolkit` | `/review-pr` | comment-analyzer, pr-test-analyzer, silent-failure-hunter, type-design-analyzer, code-reviewer, code-simplifier | Comprehensive PR analysis |
| `agent-sdk-dev` | `/new-sdk-app` | agent-sdk-verifier-py, agent-sdk-verifier-ts | Claude Agent SDK project scaffolding |
| `security-guidance` | — | — | PreToolUse hook: warns about security patterns (command injection, XSS, etc.) |
| `explanatory-output-style` | — | — | SessionStart hook: adds educational output formatting |

### Confidence Scoring Convention

Review agents score findings 0–100. The default threshold for reporting issues is **80**:
- **0** — Not confident, false positive
- **25** — Somewhat confident, might be real
- **50** — Moderately confident, real but minor
- **75** — Highly confident, real and important
- **100** — Absolutely certain, will definitely happen

False positives to filter: pre-existing issues, pedantic nitpicks, issues a linter catches, issues silenced by ignore comments.

## GitHub Actions Workflows

Located in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `claude.yml` | Issue/PR comments mentioning `@claude` | Executes Claude Code slash commands in response to mentions |
| `claude-dedupe-issues.yml` | New issue opened | Runs `/dedupe` to find and link duplicate issues |
| `claude-issue-triage.yml` | New issue opened | Applies appropriate labels automatically |
| `oncall-triage.yml` | Every 6 hours (cron) | Identifies critical/blocking issues needing on-call attention |
| `auto-close-duplicates.yml` | Daily cron | Auto-closes confirmed duplicate issues (Bun script) |
| `backfill-duplicate-comments.yml` | Manual dispatch | Backfills duplicate detection for historical issues |
| `lock-closed-issues.yml` | Scheduled | Locks old closed issues |
| `log-issue-events.yml` | Issue events | Logs events for analytics (Statsig) |

## Internal Project Commands (`.claude/commands/`)

These slash commands are available when running Claude Code in this repository:

- `/commit-push-pr` — Commit staged changes, push, and create a PR
- `/dedupe` — Find duplicate GitHub issues using 5 parallel search agents
- `/oncall-triage` — Identify critical/blocking issues for on-call team

## Scripts

Located in `scripts/`, these run with the **Bun runtime**:

- `auto-close-duplicates.ts` — Identifies and closes GitHub issues marked as duplicates (requires 3-day wait after bot detection)
- `backfill-duplicate-comments.ts` — Runs duplicate detection on historical issues

Run with: `bun run scripts/<script-name>.ts`

Required environment variables: `GITHUB_TOKEN`, `GITHUB_REPOSITORY_OWNER`, `GITHUB_REPOSITORY_NAME`

## Development Environment

### Dev Container (Recommended)

Open in VS Code with the Remote Containers extension. The `.devcontainer/` configuration provides:
- Node.js 20
- Git, GitHub CLI (`gh`), Claude Code (globally installed)
- ZSH with Powerline10k theme
- Prettier (format on save) and ESLint (auto-fix on save) pre-configured
- git-delta for enhanced diffs

### Manual Setup

```bash
npm install -g @anthropic-ai/claude-code
gh auth login          # Required for plugins using GitHub CLI
```

### Line Endings

Unix LF enforced via `.gitattributes`. All files use `eol=lf`.

## Contributing

### Adding a New Plugin

1. Create `plugins/your-plugin-name/` following the standard structure above
2. Add `plugin.json` in `.claude-plugin/` with name, version, author, description
3. Write `README.md` documenting all commands and agents
4. Register the plugin in `.claude-plugin/marketplace.json`
5. Implement commands in `commands/*.md` and agents in `agents/*.md`

### Plugin Conventions

- Use `allowed-tools` in command frontmatter to restrict tool access
- Use `gh` CLI for all GitHub API interactions (not WebFetch)
- Use parallel agent launches for independent analysis tasks
- Document confidence scoring if agents assess findings (threshold: 80 by default)
- Keep command instructions in the body concise and imperative
- Use `TodoWrite` in multi-phase workflows to track progress

### Command/Agent Naming

- Command files: kebab-case (e.g., `code-review.md`, `commit-push-pr.md`)
- Agent files: kebab-case (e.g., `code-explorer.md`, `pr-test-analyzer.md`)
- Plugin directories: kebab-case (e.g., `pr-review-toolkit/`)

## Key Resources

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Plugin System Documentation](https://docs.claude.com/en/docs/claude-code/plugins)
- [Agent SDK Documentation](https://docs.claude.com/en/api/agent-sdk/overview)
- [Hooks Documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)
- [Report Bugs](https://github.com/anthropics/claude-code/issues) or use `/bug` in Claude Code
- [Discord Community](https://anthropic.com/discord)
- [Security Vulnerabilities](https://hackerone.com/anthropic-vdp)
