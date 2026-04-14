# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is the official [Claude Code](https://github.com/anthropics/claude-code) repository — Anthropic's agentic coding tool. It contains:

- **Plugins** (`plugins/`) — 14 official plugins extending Claude Code with commands, agents, skills, and hooks
- **GitHub automation scripts** (`scripts/`) — TypeScript (Bun) and Bash scripts for issue triage, deduplication, lifecycle management
- **Slash commands** (`.claude/commands/`) — Built-in commands for commit-push-pr, dedupe, and triage-issue
- **DevContainer** (`.devcontainer/`) — Sandboxed development environment with network firewall
- **Examples** (`examples/`) — MDM deployment templates, settings examples, hook examples

This is primarily a plugin/automation repository, not a traditional application with a build/test pipeline.

## Scripts

Scripts in `scripts/` are TypeScript files meant to run with **Bun** (shebang `#!/usr/bin/env bun`). `gh.sh` is a restricted wrapper around the GitHub CLI that only allows specific subcommands (`issue view`, `issue list`, `search issues`, `label list`) scoped to the current repo.

## Plugin System

Each plugin follows this structure:
```
plugin-name/
├── .claude-plugin/plugin.json   # Metadata
├── commands/                    # Slash commands (markdown with YAML frontmatter)
├── agents/                      # Specialized agents
├── skills/                      # Auto-invoked skills
├── hooks/                       # Event handlers
├── .mcp.json                    # External tool config
└── README.md
```

## DevContainer & Firewall

The devcontainer uses `node:20`, installs Claude Code globally (`@anthropic-ai/claude-code@latest`), and runs `init-firewall.sh` on startup. The firewall uses iptables + ipset to restrict outbound traffic to only: GitHub, npm registry, Anthropic API, Sentry, Statsig, and VS Code marketplace. All other outbound connections are rejected. The container requires `NET_ADMIN` and `NET_RAW` capabilities.

## GitHub Workflows

Workflows in `.github/workflows/` automate issue management:
- `claude.yml` — Responds to @claude mentions on issues/PRs
- `claude-issue-triage.yml` — Auto-triages new issues using the `/triage-issue` command
- `claude-dedupe-issues.yml` — Detects duplicate issues
- `sweep.yml`, `auto-close-duplicates.yml`, `lock-closed-issues.yml` — Issue lifecycle automation

## Formatting

- Prettier is the default formatter (format on save)
- ESLint with auto-fix on save
- Line endings enforced as LF (`.gitattributes`)
