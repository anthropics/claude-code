---
description: Update all git-based plugins in ~/.claude/plugins/ with one command
---

## Your Task

Update all git-based Claude Code plugins to their latest versions by running `git pull` in each plugin directory.

**Related:** This addresses GitHub issue [#11676](https://github.com/anthropics/claude-code/issues/11676) - plugin update-all command.

## How This Works

This command loops through all directories in `~/.claude/plugins/` and:
1. Checks if each directory is a git repository
2. Runs `git pull` to update it
3. Reports success or errors for each plugin
4. Shows summary of results

**Note:** This only works for plugins installed via git (cloned repositories). Plugins installed via other methods will be skipped.

## Update Process

### Step 1: Check if Plugins Directory Exists

```bash
echo "=== Checking for Plugins ===" && echo ""
```

```bash
if [ -d ~/.claude/plugins ]; then echo "✓ Plugins directory found (~/.claude/plugins/)"; else echo "✗ No plugins directory found" && echo "Nothing to update."; fi
```

### Step 2: List All Installed Plugins

```bash
echo "" && echo "=== Installed Plugins ===" && echo ""
```

```bash
ls -1 ~/.claude/plugins/ 2>/dev/null | grep -v "^config.json$" || echo "No plugins found"
```

### Step 3: Identify Git-Based Plugins

```bash
echo "" && echo "=== Git-Based Plugins (Updatable) ===" && echo ""
```

```bash
for plugin in ~/.claude/plugins/*/; do if [ -d "$plugin/.git" ]; then basename "$plugin"; fi; done 2>/dev/null || echo "No git-based plugins found"
```

**If no git-based plugins found, stop here. Otherwise continue:**

### Step 4: Update Each Plugin

**Ask user for confirmation before proceeding:**

Before updating plugins, ask: **"Ready to update all git-based plugins? This will run `git pull` in each plugin directory."**

Wait for user confirmation. If yes, proceed:

```bash
echo "" && echo "=== Updating Plugins ===" && echo ""
```

For each git-based plugin, run updates:

```bash
cd ~/.claude/plugins && for plugin in */; do if [ -d "$plugin/.git" ]; then echo "" && echo "Updating: $plugin" && cd "$plugin" && git pull && cd .. || echo "Error updating $plugin"; fi; done && echo "" && echo "=== Update Complete ==="
```

### Step 5: Show Summary

After updates complete, show summary:

```bash
echo "" && echo "=== Summary ===" && echo ""
```

```bash
echo "Updated plugins are ready to use after restarting Claude Code."
```

```bash
echo "" && echo "To verify updates, check git status in each plugin:" && echo "  cd ~/.claude/plugins/plugin-name && git log -1"
```

## Expected Output

**Successful update example:**
```
=== Updating Plugins ===

Updating: developer-utilities/
Already up to date.

Updating: commit-commands/
Updating 5348233..a1b2c3d
Fast-forward
 commands/new-command.md | 50 ++++++++++++++++++++++++++++++++++++++
 1 file changed, 50 insertions(+)

Updating: feature-dev/
Already up to date.

=== Update Complete ===

=== Summary ===
Updated plugins are ready to use after restarting Claude Code.
```

**Error example:**
```
Updating: my-custom-plugin/
error: Your local changes to the following files would be overwritten by merge:
	commands/example.md
Please commit your changes or stash them before you merge.
Aborting
Error updating my-custom-plugin/
```

## Handling Errors

**Common errors and solutions:**

### 1. Merge Conflicts
```
error: Your local changes would be overwritten by merge
```
**Fix:** Manually resolve in that plugin directory:
```bash
cd ~/.claude/plugins/plugin-name
git status
git stash  # Save local changes
git pull
git stash pop  # Restore local changes
```

### 2. Authentication Required
```
fatal: Authentication failed
```
**Fix:** Set up git credentials or SSH keys for the remote repository.

### 3. Diverged Branches
```
Your branch and 'origin/main' have diverged
```
**Fix:** Manually resolve in that plugin directory:
```bash
cd ~/.claude/plugins/plugin-name
git status
git pull --rebase  # Or merge manually
```

### 4. Not a Git Repository
```
(Plugin is skipped silently)
```
**This is normal** - only git-based plugins are updated.

## What Gets Updated

**This command updates:**
- ✅ Official Anthropic plugins (cloned from anthropics/claude-code)
- ✅ Third-party plugins (cloned from any GitHub repo)
- ✅ Your own plugins (cloned from your repos)
- ✅ Forked plugins (cloned from your fork)

**This command does NOT update:**
- ❌ Plugins installed via marketplace (different update mechanism)
- ❌ Plugins that are just copied files (no .git directory)
- ❌ Symlinked plugins (updates happen in source directory)

## Best Practices

1. **Commit local changes first** - If you've modified any plugins locally, commit or stash changes before updating
2. **Run regularly** - Update plugins weekly or monthly to get latest features and fixes
3. **Check changelogs** - After updating, review what changed in each plugin
4. **Test after updating** - Restart Claude Code and verify plugins still work
5. **Backup important customizations** - If you've customized plugins, back up your changes

## Updating Individual Plugins

To update just one plugin manually:

```bash
cd ~/.claude/plugins/plugin-name
git pull
```

## Project Plugins

This command only updates global plugins in `~/.claude/plugins/`.

To update project-specific plugins in `.claude/plugins/`, run the same commands but change the path:

```bash
cd .claude/plugins && for plugin in */; do if [ -d "$plugin/.git" ]; then echo "Updating: $plugin" && cd "$plugin" && git pull && cd ..; fi; done
```

## After Updating

**Important:** Restart Claude Code for plugin updates to take effect.

Plugins are loaded when Claude Code starts, so updates won't be active until you restart your session.

## Troubleshooting

### Updates don't take effect
- **Solution:** Restart Claude Code completely (exit all sessions)

### Plugin broken after update
- **Solution:** Roll back to previous version:
```bash
cd ~/.claude/plugins/plugin-name
git log  # Find previous commit hash
git reset --hard <commit-hash>
```

### Want to prevent a plugin from updating
- **Solution:** Remove the git remote:
```bash
cd ~/.claude/plugins/plugin-name
git remote remove origin
```
Now it won't update (no remote to pull from)

## Documentation References

- [Official Plugins Documentation](https://docs.claude.com/en/docs/claude-code/plugins)
- [GitHub Issue #11676](https://github.com/anthropics/claude-code/issues/11676) - Plugin update-all request
- [Git Documentation](https://git-scm.com/docs/git-pull)

## Future Enhancements

This command currently handles git-based plugins. In the future, Claude Code may support:
- Marketplace-based plugin updates
- Version pinning
- Automatic update checks
- Rollback functionality

For now, this command provides a convenient way to update git-cloned plugins with one command instead of updating each manually.
