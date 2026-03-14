# CLAUDE.md — Claude Code Repository Guide

This file provides AI assistants with essential context for working in this repository. Read it fully before making changes.

## Repository Overview

This is the **Claude Code** official repository — an agentic coding tool that lives in your terminal, understands codebases, and executes tasks through natural language commands. The repository primarily serves as:

1. A **plugin marketplace** hosting 13 official Claude Code plugins
2. A **GitHub Actions hub** for automated issue triage, deduplication, and code review
3. A **reference implementation** for Claude Code hooks, commands, agents, and skills

There are no traditional build artifacts (no `package.json` at root, no compiled binaries). The repository is configuration- and documentation-driven.

---

## Directory Structure

```
claude-agent/
├── .claude/                    # Claude Code configuration for this repo
│   └── commands/               # Custom slash commands (dedupe, oncall-triage, commit-push-pr)
├── .claude-plugin/
│   └── marketplace.json        # Plugin registry — source of truth for the marketplace
├── .devcontainer/              # Docker dev container setup (Ubuntu + Node.js + zsh)
├── .github/
│   ├── ISSUE_TEMPLATE/         # GitHub issue templates
│   └── workflows/              # CI/CD: issue triage, deduplication, @claude automation
├── .vscode/                    # VSCode extension recommendations + settings
├── plugins/                    # 13 official Claude Code plugins (each self-contained)
│   ├── agent-sdk-dev/
│   ├── claude-opus-4-5-migration/
│   ├── code-review/
│   ├── commit-commands/
│   ├── explanatory-output-style/
│   ├── feature-dev/
│   ├── frontend-design/
│   ├── hookify/
│   ├── learning-output-style/
│   ├── plugin-dev/
│   ├── pr-review-toolkit/
│   ├── ralph-wiggum/
│   └── security-guidance/
├── scripts/                    # TypeScript utility scripts (issue deduplication, etc.)
├── CHANGELOG.md                # Version history
├── README.md                   # Public-facing documentation
└── SECURITY.md                 # Vulnerability disclosure policy (HackerOne)
```

---

## Plugin Architecture

### Plugin Structure

Every plugin is **self-contained** and follows this standard layout:

```
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json             # Plugin metadata (name, version, description, author)
├── commands/                   # Slash commands (optional)
│   └── <command>.md            # Markdown with YAML frontmatter
├── agents/                     # Specialized sub-agents (optional)
│   └── <agent>.md
├── skills/                     # Auto-triggered skills (optional)
│   └── SKILL.md
├── hooks/                      # Event-driven hooks (optional)
│   ├── hooks.json              # Hook wiring configuration
│   ├── *.py                    # Python hook implementations
│   └── *.sh                    # Bash hook implementations
├── .mcp.json                   # MCP server configuration (optional)
└── README.md                   # Plugin documentation
```

### Marketplace Registry

The single source of truth is `.claude-plugin/marketplace.json`. When adding or modifying plugins:
- Add/update entries in `marketplace.json` with `name`, `description`, `version`, `author`, and `source` fields
- The `source` field must be a relative path: `"./plugins/<plugin-name>"`
- Validate the schema against `https://anthropic.com/claude-code/marketplace.schema.json`

### Plugin Configuration Format

Commands, agents, and skills are defined as Markdown files with YAML frontmatter:

```markdown
---
name: my-command
description: What this command does
allowed-tools: [Bash, Read, Write, Edit]
context: optional-context-file.md
---

# Command instructions here
```

---

## Hook System

Hooks are event-driven scripts that execute at specific lifecycle points. All hooks use stdin/stdout with JSON for communication.

### Hook Events

| Event | Trigger |
|-------|---------|
| `PreToolUse` | Before any tool executes |
| `PostToolUse` | After any tool executes |
| `Stop` | When Claude finishes a response (used by ralph-wiggum for loops) |
| `UserPromptSubmit` | When user submits a prompt |
| `SessionStart` | When a new session begins |

### Hook Configuration (`hooks.json`)

```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/pretooluse.py",
        "timeout": 10
      }]
    }]
  }
}
```

**Key rules:**
- Always use `${CLAUDE_PLUGIN_ROOT}` for portable paths — never hardcode absolute paths
- Default timeout is **10 seconds** per hook execution
- Return JSON to stdout: `{"decision": "block", "reason": "..."}` or `{}` (allow)

### Hookify Rule Engine

The `hookify` plugin provides user-configurable rules via `.claude/hookify.*.local.md` files:

```markdown
---
name: block-rm-rf
enabled: true
event: PreToolUse
pattern: "rm -rf"
action: block
---

Block destructive rm commands.
```

Supported operators: `regex_match`, `contains`, `equals`, `not_contains`, `starts_with`, `ends_with`
Action types: `warn` (shows message, continues), `block` (prevents operation)

---

## GitHub Actions Workflows

### @claude Automation (`claude.yml`)

Triggers when `@claude` is mentioned in:
- Issue comments
- PR review comments
- PR reviews
- Issue titles or bodies

Uses `anthropics/claude-code-action@beta` with model `claude-sonnet-4-5-20250929`.

**Permissions:** `contents: read`, `pull-requests: read`, `issues: read`, `id-token: write`

### Issue Management Workflows

| Workflow | Purpose |
|----------|---------|
| `claude-issue-triage.yml` | Auto-categorize new issues |
| `claude-dedupe-issues.yml` | Detect and link duplicate issues |
| `auto-close-duplicates.yml` | Auto-close confirmed duplicates |
| `backfill-duplicate-comments.yml` | Retroactively link duplicates |
| `oncall-triage.yml` | Route critical issues to on-call |
| `stale-issue-manager.yml` | Handle stale issues |
| `lock-closed-issues.yml` | Lock closed issues to prevent noise |
| `log-issue-events.yml` | Audit logging for issue events |

---

## Custom Commands in This Repo

Located in `.claude/commands/`:

- **`dedupe.md`** — Find and link duplicate GitHub issues
- **`oncall-triage.md`** — Triage and route issues for on-call
- **`commit-push-pr.md`** — Streamlined git workflow: commit + push + open PR

---

## Key Plugins Reference

### `code-review`
Multi-agent PR review with confidence-based scoring (≥80% threshold filters false positives). Spawns 4 parallel review agents for independent perspectives.

### `pr-review-toolkit`
6 specialized review agents: inline comments, test coverage, error handling, type safety, code quality, simplification suggestions.

### `hookify`
User-configurable hook system. Rules live in `.claude/hookify.*.local.md`. The rule engine (`core/rule_engine.py`) uses LRU-cached regex compilation for performance.

### `feature-dev`
7-phase structured feature development workflow: Discovery → Planning → Implementation → Testing → Review → Documentation → Deployment.

### `ralph-wiggum`
Uses `Stop` hook for self-referential AI loops — blocks exit and re-submits prompt until a "completion promise" string appears in a tracked file.

### `security-guidance`
`SessionStart` hook that injects security reminders covering: command injection, XSS, SQL injection, path traversal, SSRF, insecure deserialization, XXE, IDOR, and broken authentication.

### `agent-sdk-dev`
Scaffolds and validates Python/TypeScript Claude Agent SDK projects. Includes verifier agents that check SDK version, environment setup, security patterns, and error handling.

---

## Development Environment

### Dev Container

The `.devcontainer/` setup provides a Docker-based environment:
- **Base:** Ubuntu with Node.js (`remoteUser: node`)
- **Terminal:** zsh (default)
- **VSCode extensions:** Claude Code, ESLint, Prettier, GitLens
- **Editor settings:** Format on save with Prettier, ESLint auto-fix on save
- **Capabilities:** `NET_ADMIN`, `NET_RAW` (for firewall initialization)

**Environment variables in container:**
```
NODE_OPTIONS=--max-old-space-size=4096
CLAUDE_CONFIG_DIR=/home/node/.claude
POWERLEVEL9K_DISABLE_GITSTATUS=true
TZ=<from local env, default: America/Los_Angeles>
```

**Volumes:**
- `claude-code-bashhistory-*` → `/commandhistory` (persisted bash history)
- `claude-code-config-*` → `/home/node/.claude` (persisted Claude config)

### IS_DEMO Variable

Set `IS_DEMO=true` to hide email and organization info from UI (used for screen recordings/demos).

---

## Commit Message Conventions

This repository uses **conventional commits**:

```
<type>(<scope>): <description>
```

**Types:** `feat`, `fix`, `chore`, `refactor`, `docs`, `revert`
**Scope:** plugin name or component (e.g., `code-review`, `hookify`, `marketplace`)

Examples:
```
chore: Update CHANGELOG.md
refactor(code-review): simplify inline comment instructions
fix(hookify): handle missing CLAUDE_PLUGIN_ROOT gracefully
```

---

## Coding Conventions

### Markdown-Based Configuration
- All commands, agents, and skills use YAML frontmatter in `.md` files
- Keep frontmatter minimal — only include fields actually used
- Tool allowlists in `allowed-tools` should follow least-privilege

### Python Hook Files
- Use `#!/usr/bin/env python3` shebang
- Import from local modules using package-relative imports (e.g., `from hookify.core.config_loader import Rule`)
- Use `sys.stdin` for input JSON and `sys.stdout` for output JSON
- Keep hooks under 10 seconds; cache expensive operations (e.g., `@lru_cache`)

### TypeScript Scripts (`scripts/`)
- Located in `scripts/` directory
- Used for GitHub automation (issue deduplication, comment backfilling)
- Run via shell wrappers (`.sh` files) when needed by workflows

### Plugin READMEs
Each plugin must have a `README.md` with:
1. Feature overview
2. Installation/usage instructions
3. Architecture explanation
4. Examples
5. Troubleshooting section

---

## Security

- Security vulnerabilities are reported via **HackerOne** — do not open public GitHub issues for security bugs
- The `security-guidance` plugin enforces security reminders on session start
- OWASP Top 10 patterns are explicitly checked: command injection, XSS, SQL injection, path traversal, SSRF, insecure deserialization, XXE, IDOR, broken authentication
- Never use `--no-verify` to bypass git hooks without explicit user permission

---

## Important Notes for AI Assistants

1. **No build step required** — this is a configuration/documentation repository; no `npm install`, `pip install`, or compilation needed at the root level
2. **Plugin isolation** — each plugin is independent; changes to one plugin don't affect others
3. **Marketplace is the registry** — always update `.claude-plugin/marketplace.json` when adding/removing plugins
4. **Branch discipline** — follow the branch naming convention `claude/<task-id>` for AI-generated branches
5. **Portable paths in hooks** — always use `${CLAUDE_PLUGIN_ROOT}` instead of hardcoded paths
6. **Do not push to `master`** — all changes go through feature branches and PRs
7. **CHANGELOG.md** — update for any user-visible change, following the existing format
8. **Permissions in workflows** — use least-privilege; the main `claude.yml` intentionally omits `write` permissions for contents/PRs/issues
