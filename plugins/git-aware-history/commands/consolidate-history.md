---
allowed-tools: Bash(ls:*), Bash(which:*), Bash(grep:*), Bash(mkdir:*), Bash(chmod:*), Bash(echo:*), Bash(cat:*), Bash(sed:*), Write
description: Consolidate Claude Code session history across git worktrees into a single per-repo directory
---

# Consolidate Git History

Merge Claude Code session history from worktrees into a single per-repo directory, and install the PATH wrapper for ongoing routing.

## When invoked

Follow these steps in order. Do not skip steps.

## Step 1: Check for the consolidation script

Check whether `~/.claude/scripts/consolidate-git-history.sh` exists:

```bash
ls -la ~/.claude/scripts/consolidate-git-history.sh 2>/dev/null || echo "NOT FOUND"
```

If NOT FOUND, install it: create `~/.claude/scripts/` if needed, then write the full content of `consolidate-git-history.sh` from this plugin directory to `~/.claude/scripts/consolidate-git-history.sh` and `chmod +x` it.

## Step 2: Run dry-run and show the plan

```bash
echo "n" | ~/.claude/scripts/consolidate-git-history.sh --dry-run
```

(Pipe "n" to skip interactive prompts during the preview.) Show the full output to the user. Ask: "Does this look right? Shall I run with --execute to apply?"

## Step 3: Run with --execute (after confirmation)

Only proceed if the user confirms. Then run interactively (no piped input — the user will answer the Phase 2 prompts themselves):

```bash
~/.claude/scripts/consolidate-git-history.sh --execute
```

Show the full output.

## Step 4: Install the PATH wrapper script

This is the preferred approach — it works in every shell and IDE without sourcing `.zshrc`.

First check if the wrapper is already installed:

```bash
ls -la ~/.local/bin/claude 2>/dev/null || echo "NOT INSTALLED"
which -a claude 2>/dev/null
```

If NOT INSTALLED, install it:

1. Find the real `claude` binary (the one that is NOT `~/.local/bin/claude`):
   ```bash
   which -a claude | grep -v "$HOME/.local/bin/claude" | head -1
   ```

2. Write the wrapper script, substituting the real binary path:
   ```bash
   mkdir -p ~/.local/bin
   sed "s|REAL_CLAUDE|<real-binary-path>|" <plugin-dir>/claude-wrapper.sh > ~/.local/bin/claude
   chmod +x ~/.local/bin/claude
   ```

3. Verify `~/.local/bin` comes before the real binary on PATH:
   ```bash
   which claude   # should show ~/.local/bin/claude
   ```

   If `which claude` still shows the old binary, `~/.local/bin` is not first on PATH. Tell the user to add this line to their shell profile and reload:
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

Once installed, every `claude` invocation (including `c=claude` aliases and IDE integrations) automatically routes worktree sessions to the correct git-root project directory.
