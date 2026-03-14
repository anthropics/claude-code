# Security Guidance Plugin

Automated security reminder hook that warns about potential security issues when editing files, including command injection, XSS, and unsafe code patterns.

## Overview

The Security Guidance Plugin uses a PreToolUse hook to detect common security anti-patterns in file edits and writes. When a potential vulnerability is detected, it blocks the tool execution with a detailed warning, ensuring the developer is aware of the risk before proceeding.

## How It Works

The plugin intercepts `Edit`, `Write`, and `MultiEdit` tool calls and checks:

1. **File path patterns** - e.g., GitHub Actions workflow files trigger injection warnings
2. **Content patterns** - e.g., `eval()`, `innerHTML`, `os.system` in new code

When a security pattern is matched for the first time in a session, the hook:
- Blocks the tool execution (exit code 2)
- Displays a detailed warning with the vulnerability type and safe alternatives
- Records the warning so it won't block the same file+pattern combination again in the same session

## Security Patterns Detected

| Pattern | Risk | Files |
|---------|------|-------|
| GitHub Actions workflow injection | Command injection via untrusted inputs | `.github/workflows/*.yml` |
| `child_process.exec` / `execSync` | Shell injection | Any JS/TS file |
| `new Function()` | Code injection | Any JS/TS file |
| `eval()` | Arbitrary code execution | Any file |
| `dangerouslySetInnerHTML` | XSS | React/JSX files |
| `document.write()` | XSS | Any JS/TS file |
| `.innerHTML =` | XSS | Any JS/TS file |
| `pickle` | Arbitrary code execution via deserialization | Python files |
| `os.system` | Shell injection | Python files |

## Configuration

The plugin can be disabled by setting the `ENABLE_SECURITY_REMINDER` environment variable:

```bash
# Disable security reminders
export ENABLE_SECURITY_REMINDER=0
```

By default, security reminders are enabled (`ENABLE_SECURITY_REMINDER=1`).

## Session Behavior

- Warnings are shown **once per file per pattern** within a session
- State is tracked in `~/.claude/security_warnings_state_<session_id>.json`
- State files older than 30 days are automatically cleaned up

## Installation

This plugin is included in the Claude Code plugin marketplace.

```bash
claude plugin install security-guidance@claude-code-plugins
```

## Requirements

- Python 3 (for the hook script)

## Author

David Dworken (dworken@anthropic.com)

## Version

1.0.0
