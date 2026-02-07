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
| Mass deletion | `rm -rf /`, `rm -rf ~`, `rm -rf $HOME`, `rm -rf .`, `rm -rf ..`, `rm -rf *` | Irreversible deletion of root, home, or working directory |
| Docker mass removal | `docker rm -f $(docker ps -aq)`, `docker system prune`, `docker volume prune`, `docker compose down -v` | Removes all containers, volumes, or system data |
| Git destructive | `git clean -fdx`, `git checkout -- .`, `git reset --hard` (no target) | Loss of uncommitted changes and untracked files |

### Allowed commands (not blocked)

| Command | Why it's safe |
|---------|--------------|
| `rm -rf node_modules` | Targets a specific, regenerable directory |
| `rm -rf /tmp/build` | Targets a temporary path |
| `rm file.txt` | No recursive force flags |
| `docker rm my-container` | Targets a specific container |
| `docker stop my-container` | Targets a specific container |
| `git clean -n` | Dry-run mode (preview only) |
| `git clean -ndx` | Dry-run mode (preview only) |
| `git reset --hard abc1234` | Has an explicit commit target |

### Protected file warnings (systemMessage, once per session)

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

## How it works

The hook intercepts `PreToolUse` events for `Bash`, `Write`, `Edit`, and `MultiEdit` tools:

1. **Bash commands**: Parses the command, splits multi-command chains (`&&`, `;`, `|`), and checks each part against destructive patterns. Blocked commands return exit code 2 with an error message on stderr.

2. **File edits**: Checks the target file path against protected patterns. If matched, outputs a one-time warning as a `systemMessage` JSON on stdout (exit code 0).

## Dependencies

Python 3.7+ (stdlib only, no external packages).
