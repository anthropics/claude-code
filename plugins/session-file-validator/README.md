# Session File Validator Plugin

A Claude Code plugin that validates file content on session resume to detect and warn about potentially stale cached data.

## Problem

When using `--resume` to continue a Claude Code session, images and files that were read in the original session are cached in the transcript. If the user asks about a different file, or if a previously-read file has changed, Claude may describe the wrong (cached) content instead of the current file.

This is documented in [GitHub Issue #15285](https://github.com/anthropics/claude-code/issues/15285).

## Solution

This plugin adds a `SessionStart` hook with a `resume` matcher that runs when sessions are resumed. It:

1. Parses the session transcript to find all image file reads
2. Checks if those files still exist on disk
3. Injects context warning Claude about potentially stale cached data
4. Instructs Claude to re-read files when asked about them

## How It Works

When you resume a session (via `--resume`, `--continue`, or `/resume`), this plugin:

1. **Detects Resume**: The hook matcher `resume` activates for resumed sessions
2. **Scans Transcript**: Parses the JSONL transcript to find Read tool results containing images
3. **Validates Files**: Checks if files still exist (deleted files are flagged)
4. **Security Checks**: Validates paths to prevent traversal attacks and checks symlink safety
5. **Injects Context**: Adds a warning to Claude's context about cached files
6. **Guides Behavior**: Instructs Claude to re-read files when asked

## Example

**Before (Bug)**:
```
Session 1: Read image1.png (RED) → Claude describes "RED"
Resume: Read image2.png (BLUE) → Claude incorrectly describes "RED"
```

**After (With Plugin)**:
```
Session 1: Read image1.png (RED) → Claude describes "RED"
Resume: Plugin warns about cached image1.png
        User asks to read image2.png → Claude reads fresh → describes "BLUE"
```

## Installation

This plugin is included in the Claude Code repository. It activates automatically when enabled in your settings.

To use it:

1. Ensure the plugin is in your `plugins/` directory
2. Claude Code will auto-discover it

## Configuration

No configuration required. The plugin activates automatically on session resume.

## Requirements

- Python 3.7+ (required for dict ordering guarantees used in deduplication)

## Limitations

- **Cannot modify transcript**: Hooks can only add context, not change cached data
- **No hash comparison**: Without storing original hashes, we can't detect modifications
- **Binary files only**: Currently focuses on image files

## Security

The plugin includes several security measures:

- **Path traversal protection**: Uses `Path.resolve()` to normalize paths and detect traversal attempts
- **Null byte detection**: Rejects paths containing null bytes
- **Symlink validation**: Checks symlinks resolve to safe locations
- **No information disclosure**: Error messages don't expose internal details
- **Safe failure**: Errors don't block session resume
- **No execution**: Only reads file metadata, never executes content

## Files

```
session-file-validator/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── hooks/
│   ├── hooks.json               # Hook configuration
│   └── session-resume-validator.py  # Main validation logic
└── README.md                    # This file
```

## Technical Details

### Hook Event

- **Event**: `SessionStart`
- **Matcher**: `resume` (activates for `--resume`, `--continue`, or `/resume`)
- **Timeout**: 30 seconds

### Input

Receives standard SessionStart hook input:
```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../session.jsonl",
  "cwd": "/path/to/project",
  "source": "resume"
}
```

### Output

Returns additional context for Claude:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "SESSION RESUME FILE VALIDATION ALERT..."
  }
}
```

## Related Issues

- [#15285](https://github.com/anthropics/claude-code/issues/15285) - Resume image caching bug
- [#13861](https://github.com/anthropics/claude-code/issues/13861) - Image cache persists after rewind

## License

MIT License
