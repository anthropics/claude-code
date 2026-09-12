# tmp-cleanup

Workaround plugin for [GitHub Issue #8856](https://github.com/anthropics/claude-code/issues/8856): Missing cleanup for `/tmp/claude-*-cwd` working directory tracking files.

## Problem

Every Bash tool invocation creates a `/tmp/claude-{4-hex}-cwd` file (22 bytes) to track the working directory after command execution. These files are **never deleted** by the runtime, causing accumulation of hundreds of files per day.

## Solution

This plugin installs two hooks:

| Hook | Event | Behavior |
|------|-------|----------|
| `tmp_cleanup_post_tool.py` | **PostToolUse** (Bash only) | Removes files older than 60 seconds |
| `tmp_cleanup_stop.py` | **Stop** (session exit) | Removes stale files (same threshold, safe for concurrent sessions) |

### Safety measures

- **Symlink protection**: Uses `os.lstat()` — never follows symlinks in `/tmp`
- **Regular file check**: Only deletes regular files, skips directories/pipes/devices
- **Strict pattern**: Validates filenames match `claude-[0-9a-f]{4}-cwd` exactly
- **Stale threshold**: Only deletes files older than 60 seconds to avoid racing with the runtime
- **Concurrent session safe**: Both hooks use the same threshold, never deletes files other sessions may need
- **Timeout**: 10-second timeout prevents blocking Claude Code on slow filesystems

## Supported Platforms

- **Linux**: Full support
- **macOS**: Full support (uses `tempfile.gettempdir()` to resolve `/private/tmp`)
- **Windows**: No effect (Claude Code on Windows uses a different temp path pattern)

## Installation

Add to your project's `.claude/settings.json`:

```json
{
  "plugins": [
    "/path/to/claude-code/plugins/tmp-cleanup"
  ]
}
```

## Requirements

- Python 3.6+
- Claude Code with hooks support
