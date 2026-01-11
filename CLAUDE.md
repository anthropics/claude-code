# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Commands

**Run automation scripts (requires Bun):**
```bash
bun run scripts/auto-close-duplicates.ts          # GitHub issue deduplication
bun run scripts/backfill-duplicate-comments.ts    # Backfill old duplicate comments
```

**Environment variables for scripts:**
- Required: `GITHUB_TOKEN` (GitHub personal access token)
- Optional: `GITHUB_REPOSITORY_OWNER`, `GITHUB_REPOSITORY_NAME`, `STATSIG_API_KEY`
- For backfill script: `DAYS_BACK` (default: inferred), `DRY_RUN=true` (safe testing)

**Development environment:**
Use the devcontainer for sandboxed development: open in VS Code or Windows with `Script/run_devcontainer_claude_code.ps1`

## Repository Architecture

This repository is a **plugin ecosystem and distribution package for Claude Code**, not a traditional web application. It contains:

### Directory Structure

- **`plugins/`** - 13 official Claude Code plugins extending functionality with custom commands, agents, and skills
- **`scripts/`** - TypeScript automation scripts (Bun runtime) for GitHub workflows and issue management
- **`.claude/`** - Local project configuration including repository-specific commands and evidence ledger
- **`.claude-plugin/`** - Plugin marketplace metadata (`marketplace.json`) for plugin distribution
- **`.github/workflows/`** - GitHub Actions automation for issue triage, deduplication, and CI
- **`examples/`** - Reference implementations for hooks (e.g., hook validators in Python)

### Plugin Architecture

Each plugin follows this structure:

```
plugin-name/
├── .claude-plugin/plugin.json      # Metadata (name, version, author, category)
├── commands/                        # Slash commands (*.md files with YAML frontmatter)
├── agents/                          # Specialized agents (*.md files with YAML frontmatter)
├── skills/                          # Agent skills (SKILL.md + resources)
├── hooks/                           # Event hooks (hooks.json + Python/TS implementations)
├── .mcp.json                        # External tool config (optional)
└── README.md                        # Plugin documentation
```

**Plugin file formats:**

Command/Agent files use markdown with YAML frontmatter:
```yaml
---
description: Brief description
argument-hint: Optional argument  # For commands only
allowed-tools: Bash, Read, Grep   # Allowed tools
model: sonnet                       # For agents
color: blue                         # For agents
---
# Title
Implementation in markdown...
```

Hook system (`hooks.json`):
```json
{
  "hooks": {
    "PreToolUse": { "command": "python3 hook.py", "timeout_ms": 5000 }
  }
}
```

Hook handlers are typically Python scripts that inspect tool calls and prevent unsafe patterns.

## Development Workflow

### Making Changes

1. **Edit plugins** - Modify `.md` files for commands/agents or Python files for hooks
2. **Write hooks** - Create Python/shell handlers in `plugin-name/hooks/` to intercept tool usage
3. **Test locally** - Run in devcontainer or with local Claude Code installation
4. **No compilation** - Markdown files are discovered and loaded dynamically

### Commit Guidelines

Follow Conventional Commits:
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation
- `chore:` maintenance

Examples: `feat(code-review): add confidence scoring`, `fix(commit): handle edge case in branch detection`

**When updating plugins:**
- Update plugin's own `README.md`
- Update `plugins/README.md` if structure or usage changes
- Update `CHANGELOG.md` for user-facing changes

### Testing & Validation

No repo-wide test suite. Validate by:
- Running scripts locally: `bun run scripts/auto-close-duplicates.ts`
- Using `DRY_RUN=true` for safe testing of GitHub automation
- Testing plugins in devcontainer or with installed Claude Code
- Running affected GitHub workflows in PRs

## 13 Official Plugins

Core categories:

**Development Tools:**
- `agent-sdk-dev` - SDK development with `/new-sdk-app` command
- `feature-dev` - 7-phase guided feature development (Discovery → Architecture → Implementation)
- `code-review` - 5 parallel agents for PR review with confidence scoring
- `plugin-dev` - Complete plugin development toolkit with 7 expert skills

**Git & Productivity:**
- `commit-commands` - `/commit`, `/commit-push-pr`, `/clean_gone` for git workflows
- `ralph-wiggum` - Self-referential AI loops for iterative problem-solving

**Learning & Style:**
- `explanatory-output-style` - Educational insights hook
- `learning-output-style` - Interactive learning mode

**Design & Security:**
- `frontend-design` - High-quality UI design skill
- `security-guidance` - Security pattern detection hook (command injection, XSS, pickle, etc.)

**Utilities:**
- `claude-opus-4-5-migration` - Model migration automation
- `hookify` - Custom hook builder from `.local.md` files
- `pr-review-toolkit` - 6 specialized PR review agents

## Key Implementation Details

### Build System

- **Runtime:** Bun (TypeScript execution)
- **Node.js requirement:** 18+
- **No webpack/vite** - Configuration-driven plugin system, not bundled
- Plugins are discovered and hot-loaded by Claude Code

### GitHub Automation

Workflows in `.github/workflows/` run scripts that:
- Use GitHub API with Bearer token authentication
- No external npm dependencies (uses Bun stdlib)
- Execute daily tasks (issue deduplication at 9 AM UTC)
- Require proper environment variables for authentication

### Local Configuration

- `.claude/settings.json` - Project-level Claude Code settings
- `.claude/skills/` - Custom project-specific skills (hot-reloaded in 2.1.0+)
- `.claude/evidence/` - Evidence ledger for tracking discovery findings

## Indentation & Naming Conventions

- **TypeScript/YAML:** 2 spaces
- **Python hooks:** 4 spaces
- **File naming:** kebab-case for plugins and commands (e.g., `frontend-design/`, `new-sdk-app.md`)
- Keep code style consistent with existing files in the plugin
