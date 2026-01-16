# Claude Code Project Management Plugin

Comprehensive Git/GitHub project management plugin with workflow automation, PR management, and issue tracking for Claude Code.

## Features

### Slash Commands (User-Invoked)

| Command | Description |
|---------|-------------|
| `/pm-status` | Display comprehensive project Git status |
| `/pm-branch` | Branch operations (create/switch/delete) |
| `/pm-sync` | Synchronize with main branch (fetch + rebase) |
| `/pm-commit` | Create semantic commits with conventional format |
| `/pm-pr` | Pull Request operations (draft/ready/status) |
| `/pm-gh` | GitHub CLI operations (issues/PRs/workflows/releases) |
| `/pm-cleanup` | Clean up merged branches |
| `/pm-rebase` | Interactive rebase for history cleanup |

### Agents (Auto/Manual Invoked)

| Agent | Specialization |
|-------|----------------|
| `git-workflow-agent` | Complex Git operations, conflict resolution |
| `pr-reviewer-agent` | Code review and quality analysis |
| `issue-tracker-agent` | Issue/PR coordination and tracking |
| `gh-cli-agent` | GitHub CLI operations and API interactions |

### Skills (Claude Auto-Invoked)

| Skill | Purpose |
|-------|---------|
| `git-workflow` | Git workflow best practices |
| `branch-strategy` | Branch naming and lifecycle |
| `pr-management` | PR creation and review process |
| `gh-cli` | GitHub CLI command reference |

### Hooks (Automatic)

| Event | Action |
|-------|--------|
| `SessionStart` | Load Git context |
| `PostToolUse[Write\|Edit]` | Check for uncommitted changes |
| `PreToolUse[Bash]` | Validate Git commands |
| `Stop` | Verify Git state before ending |

## Installation

```bash
# Clone or download the plugin
git clone <repository-url> ~/.claude/plugins/project-management

# Or install via Claude Code
/plugin install <marketplace-url>/project-management
```

## Usage

### Start a New Feature

```
/pm-branch create 123 user-login
```

Creates branch `feature/123-user-login` and sets up upstream.

### Check Status

```
/pm-status
```

Shows current branch, uncommitted changes, and sync status.

### Sync with Main

```
/pm-sync
```

Fetches and rebases onto main branch.

### Create Semantic Commit

```
/pm-commit
```

Analyzes changes and creates conventional commit.

### Manage PR

```
/pm-pr draft "Add user login feature"
/pm-pr ready
/pm-pr status
```

### GitHub CLI Operations

```
/pm-gh issue list
/pm-gh pr checks
/pm-gh run watch
```

### Clean Up After Merge

```
/pm-cleanup
```

## Workflow Philosophy

> **Git 是记账本，不是草稿纸；PR 是战役，不是游击战。**

### Core Principles

1. **Rebase over Merge**: Maintains linear history
2. **Atomic Commits**: Each commit is complete and working
3. **Draft PR First**: Start with draft, then ready for review
4. **Clean Up**: Delete branches after merge

### Conventional Commits

```
<type>(<scope>): <subject> (#<issue>)

Types: feat, fix, docs, style, refactor, perf, test, chore, ci
```

## Directory Structure

```
project-management/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── commands/                 # Slash commands
│   ├── pm-status.md
│   ├── pm-branch.md
│   ├── pm-sync.md
│   ├── pm-commit.md
│   ├── pm-pr.md
│   ├── pm-gh.md
│   ├── pm-cleanup.md
│   └── pm-rebase.md
├── agents/                   # Subagents
│   ├── git-workflow-agent.md
│   ├── pr-reviewer-agent.md
│   ├── issue-tracker-agent.md
│   └── gh-cli-agent.md
├── skills/                   # Agent Skills
│   ├── git-workflow/
│   │   ├── SKILL.md
│   │   └── COMMANDS.md
│   ├── branch-strategy/
│   │   └── SKILL.md
│   ├── pr-management/
│   │   └── SKILL.md
│   └── gh-cli/
│       ├── SKILL.md
│       └── COMMANDS.md
├── hooks/
│   └── hooks.json           # Hook configuration
├── scripts/                 # Hook scripts
│   ├── session-context.sh
│   ├── check-uncommitted.sh
│   ├── validate-git-command.sh
│   └── validate-gh-command.sh
├── README.md
├── CHANGELOG.md
└── LICENSE
```

## Requirements

- Git >= 2.38
- GitHub CLI (`gh`) for PR operations
- Claude Code >= 1.0

## License

MIT
