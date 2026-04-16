# preserve-session

[한국어](./README.ko.md)

Preserves Claude Code session history across project directory renames, moves, and copies.

## Demo

https://github.com/user-attachments/assets/05a3dd4b-dfaa-4540-a2f1-e0c2bf6583af

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
| `/preserve-session:copy` | **(v1.2.0)** Non-destructive: create independent session copies (new `sessionId`, new filename, rewritten `cwd`). Source project is untouched. |
| `/preserve-session:move` | **(v1.2.0)** Destructive: migrate session files to the current project. Source slug folder is emptied. `cwd` is rewritten for the Ctrl+A `/resume` picker filter. |
| `/preserve-session:doctor` | Diagnose the current project's preserve-session state |
| `/preserve-session:uninstall` | Permanently remove all preserve-session data (registry and hash files) |
| ~~`/preserve-session:inherit`~~ | **Deprecated in v1.2.0** — use `copy` or `move` instead. Will be removed in a future major version. |
| `/preserve-session:scan` | Scan a directory for unregistered projects and bulk-initialize them _(coming soon)_ |
| `/preserve-session:cleanup` | **(v1.3.0)** List all registered projects and remove selected entries from the registry. For stale entries, optionally also delete the associated session folder under `~/.claude/projects/<slug>/`. |

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

**After copying a project (want independent copies of old sessions):**
```
/preserve-session:fix                          # register as independent copy first
/preserve-session:copy                         # lists available projects; Claude asks which to copy from
```

**After copying a project (want to migrate old sessions entirely — abandon original):**
```
/preserve-session:fix                          # register as independent copy first
/preserve-session:move                         # lists available projects; Claude asks which to move from
```

> `copy` creates independent copies with fresh `sessionId`s; the source project keeps its sessions.
> `move` migrates the source's `.jsonl` files into the current project and empties the source.

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
- **Quit Claude Code before running `/fix`** — prevents conflicts during session folder rename. If the destination sessions folder already exists (e.g. a new session was started before running `/fix`), sessions are merged automatically and the old folder is left in place. Run `/preserve-session:cleanup` (v1.3.0) to remove stale registry entries — and optionally the leftover session folder.
- **Use ASCII-only directory names** — Claude Code maps all non-ASCII characters to `-` when computing project slugs. Two different non-ASCII paths of the same structure (e.g. same character counts per segment) can produce identical slugs, causing their sessions to be stored in the same folder. This affects `/preserve-session:copy` and `/preserve-session:move`, which copy/migrate all sessions from the slug directory without distinguishing between projects. Run `/preserve-session:doctor` to check whether your current project path contains non-ASCII characters.
- **macOS: non-ASCII paths work correctly** — macOS `realpath` returns NFD-normalized Unicode paths, but Claude Code uses NFC when computing project slugs. The hooks normalize paths to NFC before slug computation to ensure they match.

## Files

| File | Location | Purpose |
|------|----------|---------|
| `hash.txt` | `<project>/.claude/hash.txt` | Project-unique UUID |
| `project-registry.json` | `~/.claude/project-registry.json` | Maps hash → current path |

## License

MIT © 2026 SEONGIL WON. See [LICENSE](https://github.com/wonbywondev/claude-plugins/blob/main/LICENSE).
