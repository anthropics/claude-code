---
description: Run pending tasks from the queue, show status, or execute a specific number of tasks
argument-hint: "[--max N] [--dry-run] [--loop]"
allowed-tools: ["Bash", "Read", "Glob", "Grep", "Agent"]
---

# cc-taskrunner — Run Task Queue

Execute pending tasks from the queue using headless Claude Code sessions with safety hooks, branch isolation, and automatic PR creation.

## Behavior

**If $ARGUMENTS is empty or contains only flags:**
Run the taskrunner with the provided flags (or defaults).

**If $ARGUMENTS contains "--dry-run":**
Preview what would run without executing.

**If $ARGUMENTS contains "--max N":**
Run at most N tasks.

**If $ARGUMENTS contains "--loop":**
Run in polling mode (check queue every 60s).

## Steps

1. Verify prerequisites exist:
   ```bash
   command -v claude && command -v jq && command -v python3
   ```
   If any are missing, tell the user what to install.

2. Check that the taskrunner script exists:
   ```bash
   ls ${CLAUDE_PLUGIN_ROOT}/taskrunner.sh
   ```

3. Check current queue status first:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/taskrunner.sh list
   ```

4. If queue is empty and no `--loop` flag, inform user and suggest `/taskrunner-add` to queue tasks.

5. If queue has pending tasks, execute:
   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/taskrunner.sh $ARGUMENTS
   ```

6. After execution completes, show a summary:
   - Number of tasks completed vs failed
   - Links to any PRs created
   - Any tasks that reported TASK_BLOCKED

## Important Notes

- Tasks run in headless Claude Code sessions — safety hooks block interactive questions, destructive operations, and production deploys
- Each task gets its own git branch (`auto/{task-id}`) unless it has `operator` authority
- Uncommitted work in the repo is automatically stashed and restored
- Tasks that produce commits get automatic PRs via `gh` CLI
- The `--dry-run` flag previews tasks without executing them

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CC_QUEUE_FILE` | `./queue.json` | Path to the task queue |
| `CC_POLL_INTERVAL` | `60` | Seconds between polls in loop mode |
| `CC_MAX_TASKS` | `0` | Max tasks per run (0 = unlimited) |
| `CC_MAX_TURNS` | `25` | Default Claude Code turns per task |
