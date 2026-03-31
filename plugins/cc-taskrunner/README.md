# cc-taskrunner

Autonomous task queue for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with safety hooks, branch isolation, and automatic PR creation.

Queue tasks. Go to sleep. Wake up to PRs.

## Installation

```bash
claude plugin:add /path/to/cc-taskrunner
```

Or clone from the [cc-taskrunner repository](https://github.com/Stackbilt-dev/cc-taskrunner) and add the `plugin/` directory.

## Commands

| Command | Description |
|---------|-------------|
| `/taskrunner` | Run pending tasks from the queue |
| `/taskrunner-add` | Add a task to the queue |
| `/taskrunner-list` | Show all tasks and their status |

### Quick Start

```
> /taskrunner-add Write unit tests for the auth middleware in src/middleware.ts

Added task a1b2c3d4: Write unit tests for the auth middleware

> /taskrunner --max 1
```

## Safety Architecture

Three layers of protection prevent autonomous sessions from causing damage:

1. **Safety hooks** — Block `AskUserQuestion`, destructive commands (`rm -rf`, `git push --force`, `DROP TABLE`), production deploys, and secret access
2. **CLI constraints** — `--max-turns` caps agentic loops, `--output-format json` enables structured parsing
3. **Mission brief** — Every task gets explicit constraints: no questions, no deploys, no destructive ops, commit work, output completion signal

Safety hooks are **only active during task execution**, not during interactive Claude Code sessions.

## Branch Isolation

Each task runs on its own branch (`auto/{task-id}`). Main is never directly modified.

- Uncommitted work is stashed before task execution and restored after
- Tasks that produce commits get automatic PRs via `gh` CLI
- Empty branches (no commits) are cleaned up automatically

## Agents

The `task-executor` agent helps monitor and debug task execution:

```
> "Why did my last task fail?"
```

It checks queue status, exit codes, Claude Code process state, and provides debugging guidance.

## Requirements

- bash 4+, python3, jq
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` on PATH)
- Optional: `gh` CLI for automatic PR creation

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CC_QUEUE_FILE` | `./queue.json` | Path to the task queue |
| `CC_POLL_INTERVAL` | `60` | Seconds between polls in loop mode |
| `CC_MAX_TASKS` | `0` | Max tasks per run (0 = unlimited) |
| `CC_MAX_TURNS` | `25` | Default Claude Code turns per task |

## License

Apache License 2.0 — Copyright 2026 Stackbilt LLC
