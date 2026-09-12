---
description: Stop the keepalive supervisor daemon. SIGTERM, escalates to SIGKILL after timeout.
argument-hint: "[--home <path>] [--timeout-s N]"
allowed-tools: ["Bash"]
---

# /swarm-stop — stop the keepalive daemon

Sends `SIGTERM` to the running supervisor daemon, waits up to `--timeout-s` (default 5s), then `SIGKILL` if still alive. Removes the PID file.

## Bash to run

```sh
HOME_DIR="${1:-$HOME/.claude/swarm}"
TIMEOUT="${2:-5}"
claude-swarm daemon-stop --home "$HOME_DIR" --timeout-s "$TIMEOUT"
```

Output is structured JSON:

```json
{ "stopped": true, "pid": 91168, "method": "SIGTERM" }
```

or, if escalation was needed:

```json
{ "stopped": true, "pid": 91168, "method": "SIGKILL", "reason": "didn't exit within timeout" }
```

## What happens to in-flight tasks?

Tasks the daemon was actively dispatching get killed mid-flight (their `claude --print` subprocesses are children of the daemon and inherit the signal). On the next `/swarm-start`, the supervisor's `wait_for_work` loop will see those tasks still in `in_progress` and not re-claim them automatically — you'll need to manually `claude-swarm submit` them again or write a small re-dispatcher.

The "stuck-task watchdog" that auto-re-dispatches `in_progress > 30 min` tasks is in the deferred follow-up; see `IMPROVEMENTS_OVER_VANILLA_TEAMS.md`.

## Notes

- The PID file gets cleaned up automatically; safe to re-run.
- If you want a graceful drain instead, use the abort-marker pattern: drop `<worktree>/.claude/abort-<name>` for each running head, wait for them to commit WIP + exit, then `/swarm-stop`.
- After stop, the kanban + global-mind log persist on disk; re-launching the daemon picks up the existing state.
