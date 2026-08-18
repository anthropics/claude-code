# worktree-guardian

Detects orphaned agent worktrees with uncommitted or unpushed work at session start, preventing silent data loss from stale worktree cleanup.

## Problem

When agents use `isolation: "worktree"`, their work can be silently deleted by the stale worktree cleanup if the agent's commits were never pushed to a remote. Three specific scenarios cause this (see [#35862](https://github.com/anthropics/claude-code/issues/35862)):

1. **Resumed worktrees** use the current HEAD as the cleanup baseline instead of the original base commit — if a second agent makes no new commits, the first agent's work is deleted
2. **Stale cleanup** has no registry of active agent worktrees and can race with long-running agents
3. **Stale cleanup** uses `git status --porcelain -uno`, which ignores untracked files

## How It Works

### SessionStart hook

On every session start, the plugin scans `.claude/worktrees/agent-*` for worktrees with:
- Uncommitted changes (including untracked files — unlike the built-in check)
- Commits not on any remote branch
- Commits ahead of the merge-base with the default branch

If any are found, it prints a warning with the worktree path, branch name, and a `git push` recovery command.

### `/worktree-audit` command

Run `/worktree-audit` to manually check all agent worktrees and optionally push their branches to protect them.

## Installation

```bash
claude /plugin worktree-guardian
```

Or add to `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "worktree-guardian": true
  }
}
```

## Example Output

```
worktree-guardian: agent worktrees with unsaved work detected

  /home/user/project/.claude/worktrees/agent-a1b2c3d4
    branch: worktree-agent-a1b2c3d4 | 3 unpushed commit(s)
    recover: cd /home/user/project/.claude/worktrees/agent-a1b2c3d4 && git push -u origin worktree-agent-a1b2c3d4

  Run 'git push' in each worktree above to protect the work from cleanup.
  See: https://github.com/anthropics/claude-code/issues/35862
```

## Complementary Workaround

For maximum protection, also add this to your project's `CLAUDE.md`:

```
When working in a worktree (isolation: "worktree"), push your branch before
reporting completion: git push -u origin $(git branch --show-current)
```

This ensures the built-in `rev-list HEAD --not --remotes` check always detects the work.
