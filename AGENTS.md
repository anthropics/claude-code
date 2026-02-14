# AGENTS.md

This file provides guidance to AI coding assistants when working with code in this repository.

## Repository Overview

This is the official Claude Code repository - an agentic coding tool CLI that lives in the terminal. The repository contains:
- Official Claude Code plugins in `plugins/`
- GitHub automation workflows in `.github/workflows/`
- Issue management scripts in `scripts/`
- Example hooks in `examples/hooks/`

## Plugin Architecture

Plugins extend Claude Code with custom commands, agents, skills, and hooks. Each plugin follows this structure:

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (name, description, version, author)
├── commands/                 # Slash commands (markdown with YAML frontmatter)
├── agents/                   # Specialized subagents (markdown with YAML frontmatter)
├── skills/                   # Agent skills with progressive disclosure
│   └── skill-name/
│       ├── SKILL.md         # Core skill documentation
│       ├── references/      # Detailed reference docs
│       ├── examples/        # Working examples
│       └── scripts/         # Utility scripts
├── hooks/                    # Event handlers (PreToolUse, PostToolUse, Stop, etc.)
└── README.md
```

### Key Plugin Concepts

- **Commands**: Slash commands defined in markdown with `allowed-tools` frontmatter for permissions
- **Agents**: Autonomous subagents with specific tools and system prompts
- **Skills**: Auto-triggered context loaded when Claude detects relevant phrases
- **Hooks**: Event-driven automation (PreToolUse, PostToolUse, SessionStart, Stop, etc.)
- **`${CLAUDE_PLUGIN_ROOT}`**: Variable for portable paths within plugins

## Available Plugins

| Plugin | Purpose |
|--------|---------|
| `code-review` | Automated PR review with confidence-based scoring |
| `plugin-dev` | Toolkit for developing plugins (7 skills, 3 agents) |
| `feature-dev` | Structured 7-phase feature development workflow |
| `commit-commands` | Git workflow automation (`/commit`, `/commit-push-pr`) |
| `hookify` | Create custom hooks from conversation patterns |
| `agent-sdk-dev` | Agent SDK project setup and verification |
| `pr-review-toolkit` | Comprehensive PR review agents |
| `security-guidance` | Security pattern detection hook |
| `agent-session-commit` | Capture session learnings to AGENTS.md |

## Project-Level Commands

Commands in `.claude/commands/` are available project-wide:

- `/oncall-triage` - Identify critical issues needing oncall attention
- `/dedupe` - Find duplicate GitHub issues
- `/commit-push-pr` - Commit, push, and create PR in one step

## GitHub Automation

The repository uses Claude Code for GitHub automation:

- **`@claude` mentions**: Trigger Claude on issues/PRs via `.github/workflows/claude.yml`
- **Issue triage**: Auto-labeling critical issues with `oncall-triage.yml`
- **Duplicate detection**: Cross-reference issues with `claude-dedupe-issues.yml`
- **Auto-close duplicates**: Scripts in `scripts/` manage duplicate issue lifecycle

## Development Environment

### Dev Container
A sandboxed development environment is available via `.devcontainer/`:
- Pre-configured with Claude Code, ESLint, Prettier, GitLens
- Uses zsh with command history persistence
- Includes firewall initialization for network isolation

### VS Code Extensions
Recommended extensions in `.vscode/extensions.json`:
- ESLint, Prettier, Remote Containers, GitLens

## Hook Development

Example hook script in `examples/hooks/bash_command_validator_example.py`:
- Validates bash commands before execution
- Exit code 0: Allow, Exit code 1: Show warning, Exit code 2: Block with message to Claude
- Hook input is JSON on stdin with `tool_name` and `tool_input`

## When Contributing Plugins

1. Follow the standard plugin structure with `.claude-plugin/plugin.json`
2. Define `allowed-tools` in command frontmatter for security
3. Use `${CLAUDE_PLUGIN_ROOT}` for portable paths
4. Include comprehensive README.md with usage examples
5. For agents, use description with `<example>` blocks for reliable triggering
