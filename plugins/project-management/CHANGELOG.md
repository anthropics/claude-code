# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-16

### Added

#### Commands
- `/pm-status` - Comprehensive project Git status display
- `/pm-branch` - Branch operations (create/switch/delete/list)
- `/pm-sync` - Synchronize with main branch using fetch + rebase
- `/pm-commit` - Semantic commit creation with conventional format
- `/pm-pr` - PR operations (draft/ready/status/review-fix)
- `/pm-gh` - GitHub CLI operations (issues/PRs/workflows/releases)
- `/pm-cleanup` - Clean up merged branches
- `/pm-rebase` - Interactive rebase for history cleanup

#### Agents
- `git-workflow-agent` - Expert for complex Git operations and conflict resolution
- `pr-reviewer-agent` - Code review specialist for quality, security, and maintainability
- `issue-tracker-agent` - Issue/PR coordination and project tracking
- `gh-cli-agent` - GitHub CLI specialist for API operations and automation

#### Skills
- `git-workflow` - Git workflow best practices with rebase-over-merge philosophy
- `branch-strategy` - Branch naming conventions and lifecycle management
- `pr-management` - PR creation, review process, and merge strategies
- `gh-cli` - GitHub CLI command reference and best practices

#### Hooks
- `SessionStart` - Load Git and GitHub context at session start
- `PostToolUse[Write|Edit]` - Remind about uncommitted changes
- `PreToolUse[Bash]` - Validate Git and gh commands, block dangerous operations
- `Stop` - Verify Git/GitHub state before ending session

#### Scripts
- `session-context.sh` - Gather and display Git/GitHub repository context
- `check-uncommitted.sh` - Monitor uncommitted changes
- `validate-git-command.sh` - Validate and warn about dangerous Git commands
- `validate-gh-command.sh` - Validate GitHub CLI commands and check auth

### Security
- Block force push to protected branches (main, master, develop, production, staging)
- Prefer `--force-with-lease` over `--force`
- Validate Git and gh commands before execution
- Check GitHub CLI authentication before operations

## [Unreleased]

### Planned
- GitHub Actions integration for CI/CD
- Jira issue integration
- Custom branch protection rules
- Team settings synchronization
