# Tmp Cleanup Plugin

Automatically prunes leaked temporary files from Claude Code's `/tmp` directory to prevent unbounded disk usage.

## Problem

Claude Code writes temporary files to `/tmp/claude-{uid}/` that can accumulate without bound:

1. **Task `.output` files** — Background tasks and subagents capture stdout/stderr to `.output` files with no size cap. Interactive prompts in non-interactive shells, verbose builds, and runaway processes can produce individual files exceeding 46 GB (95 GB+ total observed in a single session). See [#26911](https://github.com/anthropics/claude-code/issues/26911), [#39909](https://github.com/anthropics/claude-code/issues/39909).

2. **CWD tracking files** (`claude-*-cwd`) — Small 22-byte files that accumulate at ~174/day and are never cleaned up on crash or abnormal exit. See [#8856](https://github.com/anthropics/claude-code/issues/8856).

## How It Works

A `SessionStart` hook runs automatically when Claude Code starts, resumes, or compacts. It scans the tmp directory and removes files using a three-pass strategy:

**Pass 1 — Task output cleanup:**
1. Delete `.output` files exceeding the per-file size limit (default: 100 MB)
2. Delete `.output` files older than the max age (default: 72 hours)
3. If remaining total size exceeds the budget (default: 5 GB), prune largest files first

**Pass 2 — CWD file cleanup:**
4. Delete `claude-*-cwd` files older than 24 hours, owned by the current user

When files are cleaned up, a summary is printed:

```
[tmp-cleanup] Pruned 3 task output files and 47 stale cwd files, freed 95.12 GB
```

## Safety

- **Symlink-safe**: Uses `lstat` (not `stat`) and skips symlinks at every level to prevent directory traversal
- **Path validation**: All paths are resolved and verified to be within the tmp base directory before deletion
- **Ownership check**: CWD files are only deleted if owned by the current user (UID match)
- **Regular files only**: Only deletes regular files, never directories or special files
- **Graceful failures**: All filesystem errors are caught silently — the hook never blocks session start
- **Cross-platform**: Exits cleanly on Windows where `process.getuid()` is unavailable

## Configuration

All thresholds are configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDE_TMP_CLEANUP_MAX_FILE_MB` | `100` | Max size per `.output` file in MB |
| `CLAUDE_TMP_CLEANUP_MAX_TOTAL_GB` | `5` | Max total `.output` size before pruning largest first |
| `CLAUDE_TMP_CLEANUP_MAX_AGE_HOURS` | `72` | Max age for `.output` files |
| `CLAUDE_TMP_CLEANUP_CWD_MAX_AGE_HOURS` | `24` | Max age for `claude-*-cwd` files |
| `CLAUDE_TMP_CLEANUP_DISABLED` | — | Set to `1` to disable all cleanup |

## Manual Usage

Run the cleanup script directly:

```bash
node plugins/tmp-cleanup/hooks/cleanup-tmp.mjs
```

## Author

ZVN DEV (78920650+zvndev@users.noreply.github.com)

## Version

1.0.0
