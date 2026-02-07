# destructive-command-guard

A PreToolUse hook plugin for Claude Code that blocks self-destructive Bash commands and warns about edits to agent policy files.

Addresses issues [#23871](https://github.com/anthropics/claude-code/issues/23871) and [#23870](https://github.com/anthropics/claude-code/issues/23870).

## Installation

```bash
claude --plugin-dir ./plugins/destructive-command-guard
```

Or add to your project's `.claude/settings.json`:

```json
{
  "plugins": ["./plugins/destructive-command-guard"]
}
```

## What it does

### Blocked Bash commands (exit code 2)

| Category | Blocked patterns | Why |
|----------|-----------------|-----|
| Mass deletion | `rm -rf /`, `~`, `.`, `..`, `*`, `$HOME` | Irreversible deletion of root, home, or cwd |
| System paths | `rm -rf /etc`, `/usr`, `/var`, `/home`, `/boot`, `/opt`, `/bin`, `/sbin`, `/lib`, `/Users`, `/Applications`, `/System`, `/Library` | Critical system directories |
| Variable expansion | `rm -rf $(pwd)`, `rm -rf $DIR` | Unvalidatable dynamic targets |
| Path traversal | `rm -rf /./`, `rm -rf //`, `rm -rf /../..` | Normalized to dangerous paths |
| Docker mass ops | `docker system prune`, `docker volume prune`, `docker container prune`, `docker network prune`, `docker builder prune`, `docker image prune -a`, `docker rm -f $(docker ps -aq)`, `docker volume rm $(docker volume ls -q)`, `docker compose down -v` | Mass removal of containers, volumes, images, networks |
| Git destructive | `git clean -fdx` (without `-n`), `git checkout -- .`, `git reset --hard` (no target), `git push --force`, `git branch -D`, `git stash clear`, `git stash drop` (no ref) | Loss of uncommitted changes, remote history, branches, stashes |
| Indirect execution | `eval "..."`, `sh -c "..."`, `bash -c "..."`, `... \| sh`, `base64 ... \| bash` | Bypasses all other checks |
| Alternative deletion | `find / -delete`, `find ~ -delete` | Equivalent to mass `rm` |

### Allowed commands (not blocked)

| Command | Why it's safe |
|---------|--------------|
| `rm -rf node_modules` | Targets a specific, regenerable directory |
| `rm -rf /tmp/build` | Targets a temporary path |
| `rm file.txt` | No recursive force flags |
| `docker rm my-container` | Targets a specific container |
| `docker volume rm my-data-vol` | Targets a specific named volume |
| `docker image prune` (without `-a`) | Only removes dangling images |
| `git clean -n` / `git clean -ndx` | Dry-run mode (preview only) |
| `git reset --hard abc1234` | Has an explicit commit target |
| `git push` | Normal push (no force) |
| `git push --force-with-lease` | Safe force push with protection |
| `git branch -d` | Safe delete (warns if unmerged) |
| `git stash drop stash@{0}` | Removes a single specific stash |
| `find ./src -name '*.pyc' -delete` | Scoped to a specific directory |

### Protected file warnings (systemMessage, once per session)

Warnings are triggered both by Write/Edit/MultiEdit tools AND by Bash commands that modify these files (e.g., `echo > CLAUDE.md`, `sed -i`, `mv`, `cp`, `tee`, `truncate`, `dd`).

| File pattern | Why it's protected |
|-------------|-------------------|
| `CLAUDE.md` (any path) | Agent behavior policy file |
| `.claude/settings.json` | Agent permissions and settings |
| `.claude/settings.local.json` | Local agent settings |
| `hooks/hooks.json` | Plugin hook configuration |

File edit warnings are non-blocking (exit code 0 with `systemMessage` JSON). They appear once per file per session.

## Configuration

### Disable the guard

Set the environment variable:

```bash
export ENABLE_DESTRUCTIVE_GUARD=0
```

### Session state

Warning state is stored in `~/.claude/destructive_guard_state_{session_id}.json`. Old state files (>30 days) are cleaned up automatically.

## Security model

This plugin is a **blocklist-based first line of defense** against accidental destructive commands. It is **not a sandbox** and has known limitations:

- Cannot catch all possible command obfuscation (e.g., multi-stage variable assignment, aliasing)
- Shell grammar is context-sensitive and cannot be fully parsed with regex
- Protects against common agent mistakes, not targeted adversarial attacks

**Hardening applied:**
- Session ID sanitization (path traversal prevention, CWE-22)
- Debug logs stored in `~/.claude/` instead of `/tmp` (symlink attack prevention, CWE-377)
- Atomic state file writes via `tempfile` + `os.replace` (race condition mitigation)
- Indirect execution detection (eval, sh -c, pipe-to-shell, base64 decode)
- Path normalization (catches `//`, `/./`, `/../..` variants)

## Dependencies

Python 3.7+ (stdlib only, no external packages).
