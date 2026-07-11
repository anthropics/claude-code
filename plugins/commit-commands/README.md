# Commit Commands Plugin

Streamline your git workflow with simple commands for committing, pushing, and creating pull requests.

## Overview

The Commit Commands Plugin automates common git operations, reducing context switching and manual command execution. Instead of running multiple git commands, use a single slash command to handle your entire workflow.

## Commands

### `/commit`

Creates a git commit with an automatically generated commit message based on staged and unstaged changes.

**What it does:**
1. Analyzes current git status
2. Enumerates tracked, staged, and untracked files
3. Blocks sensitive paths before reading contents, then inspects each remaining candidate individually
4. Examines recent commit messages to match your repository's style
5. Drafts an appropriate commit message
6. Stages relevant files by explicit path
7. Creates the commit

**Usage:**
```bash
/commit
```

**Example workflow:**
```bash
# Make some changes to your code
# Then simply run:
/commit

# Claude will:
# - Review your changes
# - Stage the files
# - Create a commit with an appropriate message
# - Show you the commit status
```

**Features:**
- Automatically drafts commit messages that match your repo's style
- Follows conventional commit practices
- Lists untracked files explicitly and inspects every non-sensitive candidate before staging
- Refuses `.env`, credentials, keys, and any file whose safety cannot be confirmed
- Avoids expanding a full diff before sensitive path names have been filtered
- Never uses repository-wide staging commands such as `git add .` or `git add -A`

### `/commit-push-pr`

Complete workflow command that commits, pushes, and creates a pull request in one step.

**What it does:**
1. Creates a new branch (if currently on main)
2. Applies the same per-file inspection and sensitive-file gate as `/commit`
3. Stages explicit paths and commits changes with an appropriate message
4. Pushes the branch to origin
5. Creates a pull request using `gh pr create`
6. Provides the PR URL

**Usage:**
```bash
/commit-push-pr
```

**Example workflow:**
```bash
# Make your changes
# Then run:
/commit-push-pr

# Claude will:
# - Create a feature branch (if needed)
# - Commit your changes
# - Push to remote
# - Open a PR with summary and test plan
# - Give you the PR URL to review
```

**Features:**
- Analyzes all commits in the branch (not just the latest)
- Creates comprehensive PR descriptions with:
  - Summary of changes (1-3 bullet points)
  - Test plan checklist
- Excludes sensitive or safety-unconfirmed candidates and refuses to continue if one is already staged
- Handles branch creation automatically
- Uses GitHub CLI (`gh`) for PR creation

**Requirements:**
- GitHub CLI (`gh`) must be installed and authenticated
- Repository must have a remote named `origin`

### `/clean_gone`

Cleans up local branches that have been deleted from the remote repository.

**What it does:**
1. Uses Git tracking metadata to identify branches whose upstream is gone
2. Preserves the current branch, worktrees with tracked/untracked/ignored files, and branches with commits not merged into the current `HEAD`
3. Removes only clean associated worktrees for fully merged branches
4. Deletes only fully merged eligible branches with non-force deletion
5. Reports every removed and skipped branch

**Usage:**
```bash
/clean_gone
```

**Example workflow:**
```bash
# After PRs are merged and remote branches are deleted
/clean_gone

# Claude will:
# - Find branches whose configured upstream is gone
# - Preserve branches with unique commits or any local worktree files
# - Remove only clean worktrees and fully merged eligible branches
# - Report what was removed or skipped
```

**Features:**
- Uses structured Git tracking and worktree metadata instead of matching display text
- Refuses to remove worktrees with tracked, untracked, or ignored files, or branches with unmerged commits
- Removes clean worktrees before non-force branch deletion
- Shows clear feedback about what was removed
- Reports if no cleanup was needed

**When to use:**
- After merging and deleting remote branches
- When your local branch list is cluttered with stale branches
- During regular repository maintenance

## Installation

This plugin is included in the Claude Code repository. The commands are automatically available when using Claude Code.

## Best Practices

### Using `/commit`
- Review the staged changes before committing
- Keep unrelated untracked files out of the requested commit
- Let Claude analyze your changes and match your repo's commit style
- Trust the automated message, but verify it's accurate
- Use for routine commits during development

### Using `/commit-push-pr`
- Use when you're ready to create a PR
- Ensure all your changes are complete and tested
- Claude will analyze the full branch history for the PR description
- Review the PR description and edit if needed
- Use when you want to minimize context switching

### Using `/clean_gone`
- Run periodically to keep your branch list clean
- Especially useful after merging multiple PRs
- Uses conservative safety checks in addition to requiring a gone upstream
- Helps maintain a tidy local repository

## Workflow Integration

### Quick commit workflow:
```bash
# Write code
/commit
# Continue development
```

### Feature branch workflow:
```bash
# Develop feature across multiple commits
/commit  # First commit
# More changes
/commit  # Second commit
# Ready to create PR
/commit-push-pr
```

### Maintenance workflow:
```bash
# After several PRs are merged
/clean_gone
# Clean workspace ready for next feature
```

## Requirements

- Git must be installed and configured
- For `/commit-push-pr`: GitHub CLI (`gh`) must be installed and authenticated
- Repository must be a git repository with a remote

## Troubleshooting

### `/commit` creates empty commit

**Issue**: No changes to commit

**Solution**:
- Ensure you have unstaged or staged changes
- Run `git status` to verify changes exist

### `/commit-push-pr` fails to create PR

**Issue**: `gh pr create` command fails

**Solution**:
- Install GitHub CLI: `brew install gh` (macOS) or see [GitHub CLI installation](https://cli.github.com/)
- Authenticate: `gh auth login`
- Ensure repository has a GitHub remote

### `/clean_gone` doesn't find branches

**Issue**: No branches marked as [gone]

**Solution**:
- Run `git fetch --prune` to update remote tracking
- Branches must be deleted from the remote to show as [gone]

## Tips

- **Combine with other tools**: Use `/commit` during development, then `/commit-push-pr` when ready
- **Let Claude draft messages**: The commit message analysis learns from your repo's style
- **Regular cleanup**: Run `/clean_gone` weekly to maintain a clean branch list
- **Review before pushing**: Always review the commit message and changes before pushing

## Author

Anthropic (support@anthropic.com)

## Version

1.0.1
