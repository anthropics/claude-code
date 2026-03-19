# Security Guidance Plugin

Security reminder hook that warns about potential security issues when editing files, including command injection, XSS, and unsafe code patterns.

## Overview

The Security Guidance plugin monitors file edits in real time and warns you about common security vulnerabilities before they reach your codebase. It runs as a PreToolUse hook, intercepting Edit, Write, and MultiEdit operations to check for dangerous patterns.

When a security pattern is detected, the hook **blocks the tool call** and displays a detailed warning with remediation guidance. Each warning is shown only once per file per session to avoid noise.

## Security Patterns Detected

The plugin monitors for 9 categories of security risks:

| Rule | Trigger | Risk |
|------|---------|------|
| `github_actions_workflow` | Editing `.github/workflows/*.yml` files | Command injection via untrusted inputs in workflow `run:` steps |
| `child_process_exec` | Using shell-based child process execution in Node.js | Shell injection when user input is interpolated into commands |
| `new_function_injection` | Constructing functions from dynamic strings | Code injection via arbitrary string evaluation |
| `eval_injection` | Dynamic code evaluation | Arbitrary code execution from untrusted input |
| `react_dangerously_set_html` | React's raw HTML insertion API | Cross-site scripting (XSS) with unsanitized content |
| `document_write_xss` | Writing directly to the DOM document | XSS attacks and performance degradation |
| `innerHTML_xss` | Assigning raw HTML to element properties | XSS when untrusted content is rendered as HTML |
| `pickle_deserialization` | Python's binary serialization module | Arbitrary code execution when deserializing untrusted data |
| `os_system_injection` | Python's shell command execution | Command injection with user-controlled arguments |

## How It Works

1. **Hook type**: PreToolUse — runs before any Edit, Write, or MultiEdit operation
2. **Detection**: Checks file paths and content against known dangerous patterns (substring matching and path-based rules)
3. **Blocking**: On first detection, outputs a warning to stderr and exits with code 2 (blocks the tool call)
4. **Deduplication**: Tracks warnings per `{file_path}-{rule_name}` key in a session-scoped state file (`~/.claude/security_warnings_state_{session_id}.json`)
5. **Cleanup**: Automatically removes state files older than 30 days (probabilistic, 10% chance per invocation)

## Configuration

### Disabling the Hook

Set the `ENABLE_SECURITY_REMINDER` environment variable to `0`:

```bash
ENABLE_SECURITY_REMINDER=0 claude
```

Or in your shell profile:

```bash
export ENABLE_SECURITY_REMINDER=0
```

### Debug Logging

The hook writes debug logs to `/tmp/security-warnings-log.txt` when errors occur during JSON parsing or state file operations.

## Installation

Install via the Claude Code plugin system:

```bash
# Using the plugin marketplace
/plugin install security-guidance

# Or manually, by pointing to the plugin directory
claude --plugin-dir /path/to/plugins/security-guidance
```

## Plugin Structure

```
security-guidance/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata
├── hooks/
│   ├── hooks.json           # Hook configuration (PreToolUse on Edit|Write|MultiEdit)
│   └── security_reminder_hook.py  # Main hook script (Python)
└── README.md
```

## Requirements

- Python 3.7+
- No external dependencies (uses Python standard library only)

## Author

David Dworken (dworken@anthropic.com) — Anthropic Security Team
