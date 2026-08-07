# Windows NUL Fix Plugin

Automatically removes problematic `nul` files created by Claude Code on Windows.

## The Problem

When Claude Code runs bash commands on Windows (using Git Bash or similar Unix-like shells), it sometimes uses `2>nul` for stderr redirection. This is Windows CMD syntax, but in Unix shells, it creates a literal file named `nul` instead of redirecting to the null device.

This causes several issues:
- The `nul` file cannot be easily deleted using Windows Explorer or PowerShell
- It breaks `git add` and `git commit` operations
- It can corrupt source control history
- It appears repeatedly after each bash command

**Related Issue:** [#4928](https://github.com/anthropics/claude-code/issues/4928)

## Solution

This plugin adds a `PostToolUse` hook that automatically removes any `nul` files from the current working directory after each Bash tool execution on Windows.

## Installation

### From Marketplace
```bash
claude /plugin install windows-nul-fix
```

### Manual Installation
1. Copy the `windows-nul-fix` folder to `~/.claude/plugins/`
2. Restart Claude Code

## How It Works

```
PostToolUse (Bash) → remove-nul.js → Delete 'nul' file if exists
```

The hook:
1. Only activates on Windows (`os.platform() === "win32"`)
2. Runs after every Bash tool execution
3. Checks if a `nul` file exists in the current working directory
4. Silently removes it if found
5. Does not interrupt the workflow on errors

## Manual Workarounds

If you prefer not to use this plugin, here are alternative solutions:

### Option 1: Add to .gitignore
```
nul
```

### Option 2: Delete with Git Bash
```bash
rm nul
```

### Option 3: Delete with PowerShell (elevated)
```powershell
Remove-Item "\\?\$PWD\nul" -Force
```

### Option 4: Add to CLAUDE.md
```markdown
Windows: use `2>/dev/null` not `2>nul` (causes bash to create literal file)
```

## Contents

```
windows-nul-fix/
├── .claude-plugin/
│   └── plugin.json      # Plugin metadata
├── hooks/
│   └── hooks.json       # PostToolUse hook configuration
├── scripts/
│   └── remove-nul.js    # NUL file removal script
└── README.md            # This file
```

## Requirements

- Windows operating system
- Node.js (included with Claude Code)

## License

MIT - See the main Claude Code repository for license details.
