# tmp-cleanup

Automatically prunes oversized task `.output` files from `/tmp/claude-{uid}/` to prevent unbounded disk usage.

## Problem

When Claude Code runs background tasks or subagents, their stdout/stderr is captured in `.output` files under `/tmp/claude-{uid}/`. These files have no size cap and can grow to tens of gigabytes if a command produces infinite output (e.g., an interactive prompt in a non-interactive shell, a verbose build loop, or a runaway process).

See: [#26911](https://github.com/anthropics/claude-code/issues/26911), [#15700](https://github.com/anthropics/claude-code/issues/15700), [#33789](https://github.com/anthropics/claude-code/issues/33789), [#39909](https://github.com/anthropics/claude-code/issues/39909)

## How It Works

A `SessionStart` hook runs on `startup`, `resume`, and `compact` events. It scans the tmp directory and removes `.output` files that are:

1. **Too large** — over 100 MB per file (configurable)
2. **Too old** — over 72 hours since last modified (configurable)
3. **Over budget** — if total remaining size exceeds 5 GB, the largest files are pruned first (configurable)

When files are cleaned up, a summary line is printed:

```
[tmp-cleanup] Pruned 3 task output files, freed 95.12 GB
```

## Configuration

All thresholds are configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_TMP_CLEANUP_MAX_FILE_MB` | `100` | Max size per `.output` file in MB |
| `CLAUDE_TMP_CLEANUP_MAX_TOTAL_GB` | `5` | Max total `.output` size before pruning |
| `CLAUDE_TMP_CLEANUP_MAX_AGE_HOURS` | `72` | Max age for `.output` files in hours |
| `CLAUDE_TMP_CLEANUP_DISABLED` | - | Set to `1` to disable cleanup entirely |

## Installation

Install as a Claude Code plugin:

```bash
claude plugin install tmp-cleanup
```

Or add to your project's `.claude/plugins.json`:

```json
{
  "plugins": ["tmp-cleanup"]
}
```

## Manual Usage

You can also run the cleanup script directly:

```bash
node plugins/tmp-cleanup/hooks/cleanup-tmp.mjs
```

Or add a shell alias:

```bash
alias claude-clean="rm -rf /private/tmp/claude-$(id -u)"
```
