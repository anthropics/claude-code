# Windows Null Redirect Fix Plugin

Prevents the creation of literal `nul` files on Windows by detecting and blocking incorrect null device redirections in bash commands.

**Fixes:** [GitHub Issue #23343](https://github.com/anthropics/claude-code/issues/23343)

## Problem

On Windows, when Claude Code executes bash commands through Git Bash/MSYS, using `nul` for output redirection creates a literal file named `nul` instead of discarding the output as intended.

### Why This Happens

Different shells on Windows use different null devices:

| Shell Context | Null Device |
|---------------|-------------|
| Windows CMD | `NUL` |
| PowerShell | `$null` |
| Git Bash/MSYS | `/dev/null` |

When Git Bash encounters bare `nul` (not `/dev/null`), it treats it as a regular filename.

### Why This Is Problematic

1. **Reserved Name**: `NUL` is a reserved device name on Windows
2. **Difficult to Delete**: Files named `nul` can be difficult or impossible to delete via Windows Explorer
3. **Software Issues**: May cause problems with backup software, antivirus scanners, and sync tools
4. **Edge Cases**: Confuses Windows applications that expect `NUL` to be a device name

## Solution

This plugin adds a `PreToolUse` hook that:

1. Detects bash commands containing `nul` redirections (e.g., `> nul`, `2> nul`, `&> nul`)
2. Blocks execution and provides a helpful error message
3. Suggests the correct `/dev/null` syntax

## Installation

### Option 1: Project-level installation

Add to your project's `.claude/settings.json`:

```json
{
  "plugins": [
    {
      "path": "/path/to/claude-code/plugins/windows-null-redirect-fix"
    }
  ]
}
```

### Option 2: User-level installation

Add to your user settings at `~/.claude/settings.json`:

```json
{
  "plugins": [
    {
      "path": "/path/to/claude-code/plugins/windows-null-redirect-fix"
    }
  ]
}
```

## Usage

Once installed, the hook automatically runs on Windows whenever Claude Code attempts to execute a bash command. No manual intervention is required.

### Example

If Claude tries to run:

```bash
some_command > nul 2>&1
```

The hook will block execution and display:

```
⚠️ Windows Null Device Warning (Issue #23343)

Detected '> nul' redirection in bash command.

On Windows with Git Bash/MSYS, using 'nul' creates a literal file named 'nul' 
instead of discarding output.

✅ Suggested fix: Use '/dev/null' instead of 'nul'

Fixed command:
  some_command > /dev/null 2>&1
```

## Detected Patterns

The hook detects these redirection patterns:

- `> nul` → `> /dev/null`
- `1> nul` → `1> /dev/null`
- `2> nul` → `2> /dev/null`
- `&> nul` → `&> /dev/null`
- `>> nul` → `>> /dev/null`
- `2>> nul` → `2>> /dev/null`
- `> nul 2>&1` → `> /dev/null 2>&1`

Also detects uppercase `NUL` variants commonly used in Windows CMD.

## Requirements

- Python 3.6+
- Windows operating system (hook is a no-op on other platforms)

## Files

```
windows-null-redirect-fix/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── hooks/
│   ├── hooks.json           # Hook configuration
│   └── windows_null_redirect_hook.py  # Main hook script
└── README.md                # This file
```

## Contributing

This plugin was created to address [Issue #23343](https://github.com/anthropics/claude-code/issues/23343). 
If you encounter issues or have suggestions for improvement, please open an issue or submit a pull request.

## License

This plugin is part of the Claude Code repository and is subject to the same license terms.
