# powershell-default

Replaces the default Bash tool with **PowerShell Preview** (`pwsh-preview` / `pwsh`) as the default shell for Claude Code. Works on **any OS** with PowerShell 7+ installed — Windows, macOS, and Linux.

## Problem

Claude Code's Bash tool uses bash/zsh on all platforms. On Windows, this runs inside Git Bash where PowerShell commands fail due to shell interpretation conflicts (quoting, `$_` expansion, backslash paths). Even on macOS/Linux, users who prefer PowerShell have no way to make it the default.

The current workaround is manually prefixing every command with `pwsh -Command`, which Claude often gets wrong — taking 2-3 attempts per command.

## Solution

This plugin uses Claude Code's hooks system to:

1. **SessionStart hook**: Injects PowerShell-specific instructions into Claude's context, teaching it to use PowerShell syntax for all shell commands
2. **PreToolUse hook**: Intercepts Bash tool calls and blocks common mistakes:
   - Blocks `powershell.exe` (Windows PS 5.1) — requires `pwsh` (7+)
   - Blocks backslash paths that break in the bash shell layer
   - Allows proper `pwsh -NoProfile -File` and `pwsh -NoProfile -Command` patterns

## Installation

```bash
claude --plugin-dir /path/to/plugins/powershell-default
```

Or add to your launcher script permanently.

## Requirements

- **PowerShell 7+ Preview** or **PowerShell 7+** installed and on PATH
- Install from: https://github.com/PowerShell/PowerShell/releases
- Binary name: `pwsh-preview` (preview) or `pwsh` (stable)

### Platform install commands

**Windows:**
```
winget install Microsoft.PowerShell.Preview
```

**macOS:**
```
brew install powershell/tap/powershell-preview
```

**Linux (snap):**
```
snap install powershell-preview --classic
```

**Linux (apt):**
```
apt-get install -y powershell-preview
```

## How it works

| Hook | Trigger | Action |
|------|---------|--------|
| `SessionStart` | Claude starts | Detects `pwsh-preview`/`pwsh`, injects PowerShell syntax rules into context |
| `PreToolUse:Bash` | Every Bash tool call | Blocks `powershell.exe`, blocks backslash paths, allows correct patterns |

Claude then writes all commands using PowerShell syntax. The Bash tool still executes via bash, but the commands themselves are `pwsh -NoProfile -Command "..."` or `pwsh -NoProfile -File script.ps1`.

## Example

Without plugin (3 failed attempts):
```
❌ powershell.exe -Command "Get-Process"     → bash interpretation error
❌ pwsh -Command "Get-Process | Where $_"    → $_ expanded by bash
✅ pwsh -NoProfile -File script.ps1           → finally works
```

With plugin (first attempt):
```
✅ pwsh -NoProfile -Command "Get-Process"    → works immediately
```
