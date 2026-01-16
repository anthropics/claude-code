# Project Management Plugin

A comprehensive Git/GitHub project management plugin for Claude Code with workflow automation, PR management, and issue tracking.

## Features

- **Git Workflow Automation**: Rebase-based workflow with safety checks
- **Branch Management**: Conventional naming and lifecycle management
- **PR Operations**: Draft-first workflow with review handling
- **GitHub CLI Integration**: Full gh command support
- **Safety Hooks**: Prevent dangerous operations on protected branches

## Components

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

## Workflow Philosophy

> **Git is a ledger, not a scratch pad; PRs are campaigns, not guerrilla warfare.**

### Core Principles

1. **Rebase over Merge**: Maintain linear history
2. **Atomic Commits**: One logical change per commit
3. **Conventional Commits**: Semantic commit messages
4. **Draft PRs First**: Start as draft, mark ready when complete
5. **Branch Hygiene**: Delete merged branches promptly

### Protected Branch Safety

The plugin blocks force pushes to protected branches:
- `main`
- `master`
- `develop`
- `production`
- `staging`

## Usage

### Start New Feature

```
/pm-branch create 123 add-user-login
```

### Sync with Main

```
/pm-sync
```

### Commit Changes

```
/pm-commit
```

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

## Requirements

- Git
- GitHub CLI (`gh`) - recommended for full functionality

## License

MIT
