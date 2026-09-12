---
description: Start the keepalive supervisor daemon — survives Claude Code exit, picks up new tasks live.
argument-hint: "[--home <path>] [--conductor stub|claude]"
allowed-tools: ["Bash"]
---

# /swarm-start — keepalive supervisor daemon

Launches `claude-swarm run --daemon` so the supervisor lives **outside** the Claude Code process tree. Exit the CLI and the daemon keeps polling the kanban, claiming tasks, and dispatching workers. Use `claude --resume` later and the daemon is still running.

## What this does

1. Ensures `~/.claude/swarm/` (the default keepalive home) exists.
2. Calls `claude-swarm init --home ~/.claude/swarm` (idempotent).
3. Calls `claude-swarm run --home ~/.claude/swarm --daemon --conductor claude --global-mind-log ~/.claude/swarm/global-mind.jsonl`.
4. Prints the daemon's PID, log path, and the stop command.

The conductor defaults to `claude` — real claude-swarm agents, each dispatched via `claude --print`. This is what the operator typically wants when running session-resistant. Override with `--conductor stub` for free smoke testing (no agents spawned).

## Bash to run

```sh
HOME_DIR="${1:-$HOME/.claude/swarm}"
CONDUCTOR="${2:-claude}"
mkdir -p "$HOME_DIR"
claude-swarm init --home "$HOME_DIR" 2>/dev/null || true
claude-swarm run \
    --home "$HOME_DIR" \
    --daemon \
    --conductor "$CONDUCTOR" \
    --global-mind-log "$HOME_DIR/global-mind.jsonl"
```

After this returns, the daemon is running detached. Verify with:

```sh
claude-swarm daemon-status --home ~/.claude/swarm
```

## Why a daemon?

The native `Agent` tool spawns subprocesses of the Claude Code binary; they die when you exit the CLI. The swarm daemon is a separate Python process (single-fork + setsid + IO redirection) that:

- Survives the parent shell exiting
- Survives `claude --resume` (because it isn't tied to a specific session)
- Picks up tasks submitted via `/swarm-spawn`, `/swarm-submit`, or directly via `claude-swarm submit`
- Dispatches each task by shelling out to `claude --print`, so the workers themselves also survive your CLI exit

This is the session-resistance property the plugin ships. The "Designed but deferred" meta-supervisor (multi-host respawn + pattern detection) is the next-iteration layer on top of this.

## Bridging native Claude Teams agents to the daemon

A native Agent (spawned by the binary's `Agent` tool) can register a long-running task with the daemon and exit, instead of doing the work itself. The Agent's prompt should be:

> Submit a kanban task to the keepalive swarm via Bash:
>
> ```sh
> claude-swarm submit --home ~/.claude/swarm \
>     --title "your-task-title" --prompt "your-prompt" --head builder
> ```
>
> Capture the printed task id, write it to the team's inbox, then exit. The daemon will pick up the task; results land back in the inbox when done.

This makes "native agent" and "swarm worker" share a single contract: the filesystem kanban + inbox. The native agent is the front-end (interactive, in your CLI), the daemon-spawned worker is the back-end (long-running, session-resistant).

## Notes

- The daemon's log: `~/.claude/swarm/state/daemon.log`
- The PID file: `~/.claude/swarm/state/supervisor.pid`
- Stop with `/swarm-stop` or `claude-swarm daemon-stop --home ~/.claude/swarm`
- Restart-safe: re-running this command after the daemon is already alive does nothing destructive — it just spawns a fresh fork. Run `/swarm-stop` first if you want a clean restart.
