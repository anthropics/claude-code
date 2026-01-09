# Security Guidance Plugin

Pre-edit security reminder hook that warns about potential security issues when modifying files.

## Overview

The Security Guidance Plugin provides proactive security warnings during code editing. It uses a pre-tool hook that triggers before `Edit`, `Write`, or `MultiEdit` operations to remind developers of common security vulnerabilities.

## How It Works

When you edit a file, the plugin's security hook runs automatically and checks for potential security issues:

1. **Command Injection** - Warns when editing code that executes shell commands
2. **Cross-Site Scripting (XSS)** - Alerts for HTML/JavaScript output without sanitization
3. **SQL Injection** - Detects string concatenation in database queries
4. **Unsafe Deserialization** - Warns about deserializing untrusted data
5. **Path Traversal** - Alerts for file operations with user input

## Installation

This plugin is included in the Claude Code repository. The hooks are automatically registered when using Claude Code.

## Hook Configuration

The plugin uses a `PreToolUse` hook that triggers on file modification operations:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py"
          }
        ],
        "matcher": "Edit|Write|MultiEdit"
      }
    ]
  }
}
```

## Security Checks

The hook analyzes edits for common vulnerability patterns:

| Vulnerability | Detection Pattern | Guidance |
|--------------|-------------------|----------|
| Command Injection | Shell execution functions | Use parameterized commands, validate input |
| XSS | Direct HTML output | Sanitize output, use templating engines |
| SQL Injection | String concatenation in queries | Use parameterized queries |
| Path Traversal | File operations with variables | Validate and sanitize file paths |
| Unsafe Eval | Dynamic code execution | Avoid eval, use safe alternatives |

## Example Warnings

When editing a file that contains potential vulnerabilities, you'll see warnings like:

```
Security Reminder: This file contains shell command execution.
Ensure all user input is properly sanitized before use.
Consider using parameterized commands instead of string concatenation.
```

## Best Practices

1. **Review warnings carefully** - Each warning indicates a potential security issue
2. **Don't ignore patterns** - Even false positives help build security awareness
3. **Apply defense in depth** - Use multiple layers of security
4. **Validate all input** - Never trust user input
5. **Use parameterized queries** - Avoid string concatenation for SQL
6. **Sanitize output** - Prevent XSS by encoding HTML entities

## Requirements

- Python 3 must be available in PATH
- The hook runs automatically on supported operations

## Author

David Dworken (dworken@anthropic.com)

## Version

1.0.0
