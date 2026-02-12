# Security Guidance Plugin

Proactive security reminder hook that warns about potential security vulnerabilities when editing files.

## Overview

The Security Guidance Plugin automatically detects potentially dangerous code patterns when Claude edits files. It provides contextual security warnings with remediation guidance, helping prevent common security vulnerabilities like command injection, XSS attacks, and code evaluation risks.

**Key features:**
- Detects 9 common security anti-patterns
- Shows warnings once per session per file/pattern (no spam)
- Provides detailed remediation guidance
- Session-scoped state management
- Can be disabled via environment variable

## Security Patterns Detected

### 1. GitHub Actions Workflow Injection

**Trigger:** Editing `.github/workflows/*.yml` or `.yaml` files

**Risk:** Command injection through untrusted GitHub event data (issue titles, PR descriptions, commit messages)

**Example of unsafe pattern:**
```yaml
run: echo "${{ github.event.issue.title }}"
```

**Safe alternative:**
```yaml
env:
  TITLE: ${{ github.event.issue.title }}
run: echo "$TITLE"
```

### 2. child_process.exec Command Injection

**Trigger:** Code containing `child_process.exec`, `exec(`, or `execSync(`

**Risk:** Shell command injection when user input is passed to exec

**Remediation:** Use `execFile` or `execFileNoThrow` utilities that don't invoke a shell

### 3. new Function() Code Injection

**Trigger:** Code containing `new Function`

**Risk:** Arbitrary code execution when dynamic strings are passed

**Remediation:** Consider alternative approaches that don't evaluate arbitrary code

### 4. eval() Code Injection

**Trigger:** Code containing `eval(`

**Risk:** Arbitrary code execution - major security risk

**Remediation:** Use `JSON.parse()` for data parsing or alternative design patterns

### 5. React dangerouslySetInnerHTML XSS

**Trigger:** Code containing `dangerouslySetInnerHTML`

**Risk:** Cross-site scripting (XSS) if used with untrusted content

**Remediation:** Sanitize content using DOMPurify or similar HTML sanitizer libraries

### 6. document.write XSS

**Trigger:** Code containing `document.write`

**Risk:** XSS attacks and performance issues

**Remediation:** Use DOM manipulation methods like `createElement()` and `appendChild()`

### 7. innerHTML XSS

**Trigger:** Code containing `.innerHTML =` or `.innerHTML=`

**Risk:** XSS when setting innerHTML with untrusted content

**Remediation:** Use `textContent` for plain text or sanitize HTML with DOMPurify

### 8. Python pickle Deserialization

**Trigger:** Code containing `pickle`

**Risk:** Arbitrary code execution when unpickling untrusted data

**Remediation:** Use JSON or other safe serialization formats

### 9. Python os.system Command Injection

**Trigger:** Code containing `os.system` or `from os import system`

**Risk:** Command injection if used with user-controlled arguments

**Remediation:** Use `subprocess.run()` with argument lists instead of shell strings

## How It Works

1. **Hook triggers** on `Edit`, `Write`, and `MultiEdit` tool calls (PreToolUse event)
2. **Pattern matching** checks file path and content against security patterns
3. **Deduplication** ensures each warning is shown only once per session per file/pattern combination
4. **Warning display** outputs remediation guidance to stderr
5. **Tool blocked** until the warning is acknowledged (exit code 2)

## Configuration

### Disabling the Plugin

Set the environment variable to disable security reminders:

```bash
ENABLE_SECURITY_REMINDER=0
```

### State Management

The plugin stores session state in `~/.claude/security_warnings_state_{session_id}.json` to track which warnings have been shown. State files older than 30 days are automatically cleaned up.

## Installation

This plugin is included in the Claude Code repository. The hook is automatically registered when the plugin is loaded.

**Manual testing:**
```bash
claude --plugin-dir /path/to/security-guidance
```

## Requirements

- Python 3.7+
- No external dependencies (uses stdlib only)

## Troubleshooting

### Warning not appearing

**Issue:** Expected security warning doesn't show

**Solution:**
1. Verify `ENABLE_SECURITY_REMINDER` is not set to `0`
2. Check if warning was already shown this session (deduplication)
3. Verify file content matches the pattern exactly
4. Check Python 3 is available: `python3 --version`

### Warning appears repeatedly

**Issue:** Same warning shows multiple times

**Solution:**
- This shouldn't happen due to session state tracking
- Check if `~/.claude/` directory is writable
- Verify session ID is consistent within your session

### State files accumulating

**Issue:** Many state files in `~/.claude/`

**Solution:**
- Files older than 30 days are auto-cleaned (10% chance per hook run)
- Manual cleanup: `rm ~/.claude/security_warnings_state_*.json`

## Technical Details

### Hook Configuration

From `hooks/hooks.json`:
```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py"
      }],
      "matcher": "Edit|Write|MultiEdit"
    }]
  }
}
```

### Exit Codes

- `0`: Allow tool execution (no pattern matched or warning already shown)
- `2`: Block tool execution (warning displayed, requires acknowledgment)

### Pattern Matching

Patterns can match on:
- **File path:** Lambda functions checking path structure (e.g., GitHub workflow files)
- **Content:** Substring matching in the new content being written

## Contributing

To add new security patterns, edit `hooks/security_reminder_hook.py` and add entries to the `SECURITY_PATTERNS` list:

```python
{
    "ruleName": "my_new_pattern",
    "substrings": ["dangerous_function("],
    "reminder": "Warning message with remediation guidance"
}
```

For path-based patterns:
```python
{
    "ruleName": "my_path_pattern",
    "path_check": lambda path: path.endswith(".dangerous"),
    "reminder": "Warning message"
}
```
