# Security Guidance Plugin

Security reminder hook that warns about potential security issues when editing files, including command injection, XSS, and unsafe code patterns.

## Overview

The Security Guidance Plugin monitors file edits in real time and warns about common security vulnerabilities before they are written. It uses a `PreToolUse` hook to intercept `Edit`, `Write`, and `MultiEdit` tool calls, scanning both file paths and content for dangerous patterns.

Warnings are shown once per file per session to avoid noise, and the hook can be disabled via environment variable.

## How It Works

When Claude attempts to edit or write a file, the hook:

1. Checks the **file path** against path-based rules (e.g., GitHub Actions workflows)
2. Checks the **content being written** against substring-based rules (e.g., `eval(`, `innerHTML`)
3. If a match is found and the warning hasn't been shown in this session, it **blocks the tool execution** (exit code 2) and displays a detailed security reminder
4. Subsequent edits to the same file for the same rule are allowed without re-prompting

## Security Patterns Detected

| Pattern                               | Trigger                                    | Risk                                                     |
| ------------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| **GitHub Actions Workflow Injection** | Editing `.github/workflows/*.yml`          | Command injection via untrusted inputs like issue titles |
| **child_process.exec**                | `child_process.exec`, `exec(`, `execSync(` | Shell command injection                                  |
| **new Function**                      | `new Function`                             | Code injection via dynamic code evaluation               |
| **eval**                              | `eval(`                                    | Arbitrary code execution                                 |
| **dangerouslySetInnerHTML**           | `dangerouslySetInnerHTML`                  | Cross-site scripting (XSS)                               |
| **document.write**                    | `document.write`                           | XSS and performance issues                               |
| **innerHTML assignment**              | `.innerHTML =`                             | XSS via unsanitized HTML                                 |
| **pickle deserialization**            | `pickle`                                   | Arbitrary code execution via untrusted data              |
| **os.system**                         | `os.system`, `from os import system`       | Shell command injection                                  |

## Usage

Once installed, the plugin activates automatically on every `Edit`, `Write`, and `MultiEdit` tool call. No commands or additional configuration are needed.

### Disabling the plugin

Set the environment variable to disable security reminders:

```bash
export ENABLE_SECURITY_REMINDER=0
```

## State Management

- Warnings are tracked per session using state files stored in `~/.claude/`
- Each session gets its own state file (`security_warnings_state_<session_id>.json`)
- State files older than 30 days are automatically cleaned up (10% chance per hook invocation)

## Plugin Structure

```
security-guidance/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── hooks/
│   ├── hooks.json               # Hook configuration (PreToolUse)
│   └── security_reminder_hook.py # Security pattern detection logic
└── README.md                    # This file
```

## Requirements

- Python 3 (used to run the hook script)

## Debugging

Debug logs are written to `/tmp/security-warnings-log.txt` when errors occur during hook execution.

## Author

David Dworken (dworken@anthropic.com)

## Version

1.0.0
