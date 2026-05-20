# Security Guidance

Security reminder plugin for Claude Code that warns about risky code patterns before tool execution.

## What It Includes

- **Hook:** `PreToolUse`
- **Handler:** `hooks/security_reminder_hook.py`
- **Coverage:** command injection, XSS, `eval`, dangerous HTML rendering, pickle deserialization, `os.system`, and similar high-risk patterns

## Usage

Install the plugin, then let the hook run automatically whenever Claude Code prepares an edit or command that matches one of the protected patterns.

## Files

```text
security-guidance/
├── .claude-plugin/plugin.json
├── hooks/hooks.json
└── hooks/security_reminder_hook.py
```
