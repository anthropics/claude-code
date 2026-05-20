# bash-workdir-guard

A Claude Code plugin that warns when Bash commands navigate outside the project workspace boundary, suggesting safer alternatives.

## Problem

Claude Code's Bash tool states that "working directory persists between commands," but in practice, navigating outside the approved workspace triggers a silent auto-reset back to the project directory. This causes confusion when agents use `cd /external && command` patterns, leading to:

- Commands running in unexpected directories after auto-reset
- Unnecessary git permission prompts
- Wasted iterations debugging directory state

See [anthropics/claude-code#45478](https://github.com/anthropics/claude-code/issues/45478) for details.

## Solution

This plugin adds a `PreToolUse` hook on the `Bash` tool that:

1. Parses the command for `cd` or `pushd` targets
2. Checks if the target resolves to a path outside the project workspace
3. If outside: **blocks the command** with an advisory message suggesting safer alternatives
4. If inside: allows the command to proceed normally

## Safer Alternatives Suggested

When a command tries to navigate outside the workspace, the plugin suggests:

- **Absolute paths**: `ls /tmp` instead of `cd /tmp && ls`
- **Tool flags**: `git -C /other/repo status`, `make -C /other/dir build`
- **Subshells**: `(cd /tmp && command)` to avoid cwd side effects

## Installation

```bash
# From the plugin directory
claude --plugin-dir /path/to/bash-workdir-guard

# Or install from the marketplace (once published)
/plugin install bash-workdir-guard
```

## How It Works

- **Hook type**: `PreToolUse` (command-based)
- **Matcher**: `Bash` (only intercepts Bash tool calls)
- **Detection**: Extracts `cd`/`pushd` targets, resolves paths, checks against `$CLAUDE_PROJECT_DIR`
- **Behavior**: Exit 2 (block + warn) for outside paths, Exit 0 (allow) for inside paths

## Known Limitations

- **Quoted paths**: `cd "/path with spaces"` may not be parsed correctly
- **Variable paths**: `cd "$DIR"` or `cd ${HOME}` are not resolved
- **Command substitution**: `cd $(pwd)` is not evaluated
- Only detects `cd` and `pushd` — other directory-changing commands are not covered

These are acceptable trade-offs for a lightweight, zero-dependency hook. Complex path resolution would require a full shell parser.

## Requirements

- Claude Code v2.1.32 or later
- `jq` available in PATH (for JSON parsing)
- `bash` shell

## Development

```bash
# Test locally
claude --plugin-dir ./bash-workdir-guard

# Reload after changes
/reload-plugins
```
