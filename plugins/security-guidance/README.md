# Security Guidance Plugin

A security reminder hook that warns about potential vulnerabilities when editing files. Monitors 11 common security patterns and blocks dangerous edits with contextual guidance.

## Overview

The Security Guidance Plugin adds a PreToolUse hook that intercepts file edit operations (Edit, Write, MultiEdit) and checks for known vulnerability patterns. When a pattern is detected, the hook blocks the edit and displays a detailed security reminder with safe alternatives.

Warnings are shown once per file per pattern per session to avoid repetition.

## Security Patterns

| Pattern | Trigger | Risk |
|---------|---------|------|
| GitHub Actions Injection | Editing `.github/workflows/*.yml` | Command injection via untrusted inputs |
| `child_process.exec()` | Using `exec()` or `execSync()` | Shell command injection |
| `new Function()` | Dynamic code construction | Code injection |
| `eval()` | Arbitrary code execution | Code injection |
| `dangerouslySetInnerHTML` | React unsafe HTML rendering | XSS |
| `document.write()` | Direct document manipulation | XSS |
| `.innerHTML =` | Unsafe HTML insertion | XSS |
| `pickle` | Python deserialization | Arbitrary code execution |
| `os.system` | Python shell commands | Command injection |
| `f"SELECT ..."` | SQL string interpolation | SQL injection |
| `password = "..."` | Hardcoded secrets in code | Secret leakage |

## How It Works

1. Claude Code invokes a file editing tool (Edit, Write, or MultiEdit)
2. The hook checks the file path and content against security patterns
3. If a match is found and hasn't been shown this session, it:
   - Displays a detailed warning with safe alternatives
   - Blocks the edit (exit code 2)
4. On subsequent edits matching the same pattern in the same file, the edit proceeds without interruption

## Configuration

Disable the hook by setting the environment variable:

```bash
export ENABLE_SECURITY_REMINDER=0
```

## Installation

```bash
/plugin install security-guidance@claude-plugins-official
```
