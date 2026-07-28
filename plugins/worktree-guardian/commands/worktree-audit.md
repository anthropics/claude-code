Run a full audit of all agent worktrees in this repository.

For each worktree under `.claude/worktrees/agent-*`:

1. Check `git status --porcelain` for uncommitted changes (including untracked files)
2. Check `git rev-list --count HEAD --not --remotes` for unpushed commits
3. Check `git rev-list --count $(git merge-base HEAD origin/main)..HEAD` for diverged commits
4. Report the branch name, path, and recovery command for any worktree with unsaved work

If any worktrees have unsaved work, offer to push their branches to protect them.
If all worktrees are clean, report that no action is needed.
