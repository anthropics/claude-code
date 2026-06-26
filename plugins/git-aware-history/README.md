# Git-Aware History Plugin

Fix Claude Code session history fragmentation across git worktrees.

## The Problem

Claude Code keys session history by the working directory path (`~/.claude/projects/<slug>/`). When you use git worktrees, each worktree gets its own isolated history directory. Deleting a worktree orphans its history — `/resume` can't find it, and there's no way to see all sessions for a repo in one place.

Active worktree users end up with dozens of orphaned history directories after a sprint.

## The Solution

`git rev-parse --git-common-dir` returns the **same** `.git` path for any worktree of a repo. This plugin uses that as the canonical project identity, so all worktrees of a repo share one history directory.

## Components

### 1. PATH wrapper script (ongoing routing)

A small `claude` wrapper script installed to `~/.local/bin/claude` — **before** the real binary on PATH. It runs `git rev-parse --git-common-dir` on every invocation and symlinks the worktree's project dir to the git-root's project dir before Claude Code opens it.

**No shell function, no alias, no `.zshrc` sourcing required. Gated by a flag file so you can disable/re-enable without touching the script:** Because it sits on PATH, it works in every shell (bash, zsh, fish), every terminal, and IDE integrations that don't load shell profiles. The real `claude` binary path is baked in at install time.

```bash
touch ~/.claude/git-aware-history.enabled   # enable
rm    ~/.claude/git-aware-history.enabled   # disable
```


### 2. Consolidation script (`consolidate-git-history.sh`)

Retroactively migrates existing orphaned history. Two phases:

- **Phase 1 — live paths**: finds all project dirs whose worktrees still exist, groups them by git root, merges and symlinks automatically
- **Phase 2 — deleted paths**: interactively handles orphaned dirs from already-deleted worktrees. Shows metadata (session count, size, date range, branch names) per group. Supports `fzf --multi` or a numbered fallback menu.

Always dry-runs first. Use `--execute` to apply.

### 3. `/consolidate-history` command

End-to-end setup in one command: installs the wrapper script to the right PATH location, migrates existing history with a dry-run preview + confirmation, and verifies everything is wired up.

## Installation

### Option A: via `/consolidate-history` command (recommended)

If you have this plugin installed, just run:
```
/consolidate-history
```

Claude will:
1. Find the real `claude` binary path
2. Install the wrapper script to `~/.local/bin/claude`
3. Verify `~/.local/bin` is on PATH before the real binary (and guide you to fix it if not)
4. Migrate your existing history with a dry-run preview

### Option B: manual

1. Copy `consolidate-git-history.sh` to `~/.claude/scripts/` and make it executable:
   ```bash
   mkdir -p ~/.claude/scripts
   cp consolidate-git-history.sh ~/.claude/scripts/
   chmod +x ~/.claude/scripts/consolidate-git-history.sh
   ```

2. Install the PATH wrapper. First find your real `claude` binary:
   ```bash
   which claude   # e.g. /opt/homebrew/bin/claude
   ```

   Then install the wrapper to `~/.local/bin/claude`, substituting the real path:
   ```bash
   mkdir -p ~/.local/bin
   sed "s|REAL_CLAUDE|/opt/homebrew/bin/claude|" claude-wrapper.sh > ~/.local/bin/claude
   chmod +x ~/.local/bin/claude
   ```

3. Ensure `~/.local/bin` is before the real binary on PATH. Add to your shell profile if needed:
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

   Verify:
   ```bash
   which claude      # should show ~/.local/bin/claude
   which -a claude   # should show ~/.local/bin/claude first, then the real binary
   ```

4. Migrate existing history:
   ```bash
   ~/.claude/scripts/consolidate-git-history.sh --dry-run
   ~/.claude/scripts/consolidate-git-history.sh --execute
   ```

## Usage

### Migrate existing history

```bash
# Dry-run (safe — no changes)
~/.claude/scripts/consolidate-git-history.sh --dry-run

# Apply
~/.claude/scripts/consolidate-git-history.sh --execute
```

During `--execute`, Phase 2 prompts you interactively for each group of orphaned sessions:

```
Orphaned sessions — inferred repo: /Users/you/dev/myrepo (inferred)
  [1] -...-feature-auth     |  2 sessions  |  1.2MB  |  Apr 28  |  feature/auth
  [2] -...-bugfix-login     |  1 session   |  340KB  |  Apr 15  |  bugfix/login

Merge into: -Users-you-dev-myrepo?
  [a] all   [n] none   [1,2,...] pick numbers   [s] skip group
>
```

### Test safely with a temp directory

```bash
PROJECTS_DIR=$(mktemp -d) bash ~/.claude/scripts/consolidate-git-history.sh --execute
```

## How It Works

The slug algorithm matches Claude Code's existing behaviour: replace every `/` and `.` in the path with `-`. The wrapper computes slugs for both the current CWD and the git root — if they differ (you're in a worktree), it creates a symlink `~/.claude/projects/<cwd-slug>` → `~/.claude/projects/<git-root-slug>` using `ln -sfn` (the `-n` flag prevents nesting inside an existing directory).

## Compatibility

- macOS (bash 3.2+) and Linux
- No dependencies beyond `git`, `python3` (ships with macOS), and optionally `fzf` for better interactive UX
- `fzf` is used automatically when available and stdin is a TTY; falls back to a numbered text menu otherwise

## Upstream Fix

The root cause is that Claude Code uses the raw CWD as the project key instead of the git repo root. The minimal upstream fix is one function in Claude Code's project-path computation:

```typescript
async function resolveProjectRoot(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--git-common-dir'], { cwd });
    const gitCommonDir = stdout.trim();
    const absCommonDir = path.isAbsolute(gitCommonDir)
      ? gitCommonDir
      : path.join(cwd, gitCommonDir);
    return path.dirname(absCommonDir);
  } catch {
    return cwd;
  }
}
```

This plugin is the userland workaround until that change lands. Tracked in [anthropics/claude-code#52113](https://github.com/anthropics/claude-code/issues/52113).
