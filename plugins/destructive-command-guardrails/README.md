# Destructive Command Guardrails

PreToolUse hook that intercepts destructive shell commands before execution, preventing accidental data loss from autonomous agent actions.

## Why This Plugin?

Agents can autonomously execute shell commands. When an agent misinterprets instructions or hallucinates a cleanup step, the result can be catastrophic:

- `rm -rf /` instead of `rm -rf ./dist` ([#28521](https://github.com/anthropics/claude-code/issues/28521))
- `Remove-Item -Recurse -Force` traversing NTFS junctions into user profile folders ([#29249](https://github.com/anthropics/claude-code/issues/29249))
- `git clean -fd` wiping gitignored files needed by the project ([#29179](https://github.com/anthropics/claude-code/issues/29179))
- `find / -delete` during a security test ([#28521](https://github.com/anthropics/claude-code/issues/28521))
- Unauthorized `rm` wiping project files ([#29082](https://github.com/anthropics/claude-code/issues/29082))

This plugin adds a safety net: every Bash tool call is checked against known destructive patterns *before* execution. Dangerous commands are blocked and logged, giving you a chance to review before any damage is done.

## What It Catches

### CRITICAL (always blocked)
| Pattern | Example | Risk |
|---------|---------|------|
| `rm -rf` | `rm -rf /` | Recursive forced deletion with no recovery |
| `PowerShell Remove-Item -Recurse -Force` | `Remove-Item C:\ -Recurse -Force` | NTFS junction traversal can destroy unrelated dirs |
| `DROP TABLE/DATABASE` | `DROP TABLE users;` | Permanent schema + data destruction |
| `TRUNCATE TABLE` | `TRUNCATE TABLE orders;` | Instant row deletion, not rollback-safe |
| `mkfs` | `mkfs.ext4 /dev/sda1` | Formats entire filesystem |
| `dd of=/dev/` | `dd if=/dev/zero of=/dev/sda` | Raw device overwrite |
| `sudo` + destructive cmd | `sudo rm -rf /var` | Elevated destruction bypasses all permissions |

### HIGH (blocked — likely data loss)
| Pattern | Example | Risk |
|---------|---------|------|
| `git reset --hard` | `git reset --hard HEAD~5` | Discards all uncommitted work |
| `git clean -fd` | `git clean -fd` | Deletes all untracked files + dirs |
| `git push --force` | `git push -f origin main` | Overwrites remote history |
| `DELETE FROM` (no WHERE) | `DELETE FROM users;` | Removes all table rows |
| `docker volume prune` | `docker volume prune` | Destroys persistent data volumes |
| `find -delete` / `find -exec rm` | `find . -name "*.log" -delete` | Recursive silent deletion |
| Overwrite dotfiles | `> .env` | Truncates config/secrets files to zero |
| `rm -r` on broad paths | `rm -r ~/` | Recursive deletion of home dir |

### MEDIUM (blocked — potentially destructive)
| Pattern | Example | Risk |
|---------|---------|------|
| `git checkout -- .` | `git checkout -- .` | Discards all unstaged changes |
| `git stash clear` | `git stash clear` | Destroys all stashed changes |
| `git branch -D` | `git branch -D feature` | Force-deletes unmerged branch |
| `kill -9` (process patterns) | `killall -9 node` | Force-kills with no state save |
| `docker system prune -a` | `docker system prune -a` | Removes all unused Docker objects |
| `pip uninstall -y` | `pip uninstall -y numpy` | Uninstalls without confirmation |
| `npm cache clean --force` | `npm cache clean --force` | Destroys entire npm cache |
| Silent backgrounded commands | `cmd > /dev/null 2>&1 & disown` | Invisible, uncontrollable process |

## Smart Allowlisting

Not every `rm -rf` is dangerous. The plugin allows common safe patterns:

- **Build artifact cleanup**: `rm -rf node_modules`, `dist`, `build`, `.cache`, `__pycache__`, `.next`, `.nuxt`, `coverage`, `.pytest_cache`, `.mypy_cache`, `tmp`, `temp`
- **Temp directory cleanup**: `rm -rf /tmp/...`
- **Git dry-run**: `git clean -n` (preview mode)
- **Filtered Docker prune**: `docker prune --filter ...`
- **Specific PID kills**: `kill -9 12345` (a single numeric PID)

## Security Logging

All blocked commands are logged (with full command text) to:
```
~/.claude/security-logs/guardrails-YYYY-MM-DD.jsonl
```

Each entry is structured JSON:
```json
{
  "timestamp": "2026-03-02T21:30:00.000000",
  "event": "blocked",
  "session_id": "abc123",
  "cwd": "/home/user/project",
  "command": "rm -rf /",
  "rule": "rm_recursive_force",
  "severity": "CRITICAL"
}
```

Review logs:
```bash
# Today's blocks
cat ~/.claude/security-logs/guardrails-$(date +%Y-%m-%d).jsonl | python3 -m json.tool

# All critical blocks
cat ~/.claude/security-logs/guardrails-*.jsonl | python3 -c "
import sys, json
for line in sys.stdin:
    e = json.loads(line)
    if e['severity'] == 'CRITICAL':
        print(f\"{e['timestamp']} {e['rule']}: {e['command']}\")
"
```

## Installation

### Option 1: Copy to plugins directory

```bash
cp -r destructive-command-guardrails ~/.claude/plugins/
```

### Option 2: Add to settings.json

```json
{
  "plugins": [
    "/path/to/destructive-command-guardrails"
  ]
}
```

## Chained Command Support

The plugin splits on `&&`, `||`, `;`, and `|` — so chained commands like:

```bash
cd /tmp && rm -rf / ; echo "done"
```

are correctly caught even though the destructive part is in the middle.

## Disabling for a Session

If you need to run a blocked command intentionally, either:

1. Run it directly in your terminal (outside the agent)
2. Temporarily remove the plugin from your settings

## Requirements

- Python 3.8+ (standard library only — no external dependencies)
