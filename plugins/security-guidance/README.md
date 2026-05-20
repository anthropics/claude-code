# Security Guidance Plugin

A security reminder hook that warns about potential security issues when editing files, including command injection, XSS, and unsafe code patterns.

## Overview

The Security Guidance Plugin monitors file edits in real-time and warns you about potentially dangerous security patterns. It acts as a safety net, helping you avoid common security vulnerabilities before they make it into your codebase.

**Key features:**
- 🔍 Monitors 9 common security vulnerability patterns
- ⚠️ Shows contextual warnings with specific guidance
- 🚫 Blocks potentially dangerous edits (configurable)
- 🔄 Session-scoped warnings (won't repeat the same warning repeatedly)
- 🐍 Zero dependencies (uses Python 3 stdlib only)

## What it detects

The plugin checks for these security patterns:

### 1. GitHub Actions Workflow Injection
**Pattern**: Using untrusted GitHub context variables directly in `run:` commands
**Risk**: Command injection via malicious issue titles, PR descriptions, or commit messages
**Safe alternative**: Use environment variables with proper quoting

### 2. child_process.exec() / execSync()
**Pattern**: Using `child_process.exec()` with dynamic input
**Risk**: Shell command injection
**Safe alternative**: Use `execFile()` or the provided `execFileNoThrow()` utility

### 3. new Function() Constructor
**Pattern**: Creating functions from dynamic strings
**Risk**: Code injection and arbitrary code execution
**Safe alternative**: Use static functions or JSON.parse() for data

### 4. eval() Usage
**Pattern**: Using `eval()` to evaluate code strings
**Risk**: Arbitrary code execution
**Safe alternative**: Use JSON.parse() or safe parsing libraries

### 5. React dangerouslySetInnerHTML
**Pattern**: Setting HTML content directly in React
**Risk**: XSS (Cross-Site Scripting) attacks
**Safe alternative**: Use textContent or sanitize HTML with DOMPurify

### 6. document.write()
**Pattern**: Using `document.write()` in browser code
**Risk**: XSS and performance issues
**Safe alternative**: Use DOM manipulation methods (createElement, appendChild)

### 7. innerHTML Assignment
**Pattern**: Setting `.innerHTML` with dynamic content
**Risk**: XSS attacks
**Safe alternative**: Use `.textContent` or sanitize HTML properly

### 8. Python pickle Module
**Pattern**: Using `pickle` for serialization
**Risk**: Arbitrary code execution with untrusted data
**Safe alternative**: Use JSON or other safe serialization formats

### 9. os.system() Calls
**Pattern**: Using `os.system()` in Python
**Risk**: Command injection
**Safe alternative**: Use `subprocess.run()` with proper argument lists

## How it works

The plugin uses a PreToolUse hook that:
1. Intercepts Edit, Write, and MultiEdit tool calls
2. Checks the file path and new content against security patterns
3. Shows a contextual warning if a pattern is detected
4. Blocks the edit (exit code 2) if the pattern matches
5. Tracks shown warnings per session (won't repeat warnings for the same issue)

## Usage

The plugin activates automatically when installed. No additional configuration is required.

### Disabling temporarily

Set the environment variable to disable:
```bash
ENABLE_SECURITY_REMINDER=0 claude
```

### Warning behavior

Each warning type is shown only once per file per session. This prevents repeated warnings while still alerting you to potential issues.

Warning state is stored in `~/.claude/security_warnings_state_<session_id>.json` and is automatically cleaned up after 30 days.

## Example warnings

### GitHub Actions Example
When editing `.github/workflows/deploy.yml`:

```
You are editing a GitHub Actions workflow file. Be aware of these security risks:

1. **Command Injection**: Never use untrusted input (like issue titles, PR descriptions, 
   commit messages) directly in run: commands without proper escaping
2. **Use environment variables**: Instead of ${{ github.event.issue.title }}, use env: 
   with proper quoting
3. **Review the guide**: https://github.blog/security/...

Example of UNSAFE pattern to avoid:
run: echo "${{ github.event.issue.title }}"

Example of SAFE pattern:
env:
  TITLE: ${{ github.event.issue.title }}
run: echo "$TITLE"
```

### eval() Warning Example
When editing a JavaScript file containing `eval(userInput)`:

```
⚠️ Security Warning: eval() executes arbitrary code and is a major security risk. 
Consider using JSON.parse() for data parsing or alternative design patterns that 
don't require code evaluation. Only use eval() if you truly need to evaluate 
arbitrary code.
```

## Requirements

- Python 3.7 or higher
- No external dependencies (uses stdlib only)

## Technical Details

### Hook Configuration
The hook is configured in `hooks/hooks.json`:
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

### Security Patterns
Patterns are defined in `security_reminder_hook.py` with:
- `ruleName`: Unique identifier for the pattern
- `substrings` or `path_check`: Matching logic
- `reminder`: Contextual warning message

### State Management
- Session-scoped warnings using session ID
- JSON state files stored in `~/.claude/`
- Automatic cleanup of files older than 30 days

## Troubleshooting

### Warnings not showing
- Ensure the plugin is installed and enabled
- Check that ENABLE_SECURITY_REMINDER is not set to 0
- Verify the file being edited matches a pattern

### Too many repeated warnings
This shouldn't happen as warnings are session-scoped. If it does:
- Check the state file permissions in `~/.claude/`
- Ensure the session ID is consistent

### False positives
If you encounter false positives:
- The warnings are informational - you can proceed if the usage is intentional
- Consider if there's a safer alternative pattern
- File an issue to improve the pattern matching

## Contributing

Found a security pattern that should be added? This plugin can be extended with additional patterns in `security_reminder_hook.py`.

To add a new pattern:
1. Add a dictionary to the SECURITY_PATTERNS list
2. Include `ruleName`, matching logic, and `reminder` message
3. Test with sample files

## Author

David Dworken (dworken@anthropic.com)

## Version

1.0.0

## License

MIT
