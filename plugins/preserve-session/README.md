# preserve-session

[한국어](./README.ko.md)

Preserves Claude Code session history across project directory renames, moves, and copies.

## Problem

Claude Code identifies projects by their directory path. Renaming or moving a project directory causes all previous session history to become unreachable.

## How it works

Each project gets a path-independent UUID stored in `.claude/hash.txt`. A global registry (`~/.claude/project-registry.json`) maps each UUID to its current path. When the path changes, running `/preserve-session:fix` renames the internal sessions folder to match, restoring access to all previous sessions.

## Installation

```
claude plugin install preserve-session
```

The `SessionStart` hook is included in the plugin and activated automatically on install. No manual configuration needed.

**For local testing:**
```
claude --plugin-dir /path/to/plugins/preserve-session
```

## Commands

| Command | Description |
|---------|-------------|
| `/preserve-session:fix` | Recover sessions after a rename or move. Also handles copy detection |
| `/preserve-session:inherit` | Copy session history from another project into the current one |
| `/preserve-session:doctor` | Diagnose the current project's preserve-session state |
| `/preserve-session:scan` | _(planned)_ Scan a directory for unregistered projects and bulk-initialize them |

## Typical workflows

**After renaming a directory:**
```
cd /new/project/name
claude
/preserve-session:fix
```

**After copying a project (want fresh start, protect original):**
```
# No action needed — the copy is detected automatically on /fix
# and registered as an independent project
```

**After copying a project (want to continue old sessions):**
```
/preserve-session:fix                          # register as independent copy first
/preserve-session:inherit                      # lists available projects
# Claude will ask which project to inherit from, then run:
# /preserve-session:inherit --from /original/path
```

**Check current state:**
```
/preserve-session:doctor
```

## Understanding doctor output

- **Hook not in settings.json** — the hook is still active; it does not need to appear in `settings.json` to work.
- **Path mismatch / stale registry entry** — run `/preserve-session:fix` to update the registry to the current path and clean up stale entries.

## Notes

- **Use the terminal, not the VS Code extension** — plugin commands and session history browsing are not fully supported in the VS Code extension. Use `claude` in a terminal for the best experience.
- **Add `.claude/hash.txt` to `.gitignore`** — in team projects, sharing the same UUID causes registry conflicts
- **`project-registry.json` is local only** — do not include in backups or sync tools
- **Quit Claude Code before running `/fix`** — prevents conflicts during session folder rename

## Files

| File | Location | Purpose |
|------|----------|---------|
| `hash.txt` | `<project>/.claude/hash.txt` | Project-unique UUID |
| `project-registry.json` | `~/.claude/project-registry.json` | Maps hash → current path |
