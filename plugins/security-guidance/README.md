# Security Guidance Plugin

A PreToolUse hook that monitors file edits for common security anti-patterns and warns about potential vulnerabilities before they're written.

## What It Does

When Claude uses `Edit`, `Write`, or `MultiEdit` tools, this hook scans the file path and content for known security risks and blocks the operation with a detailed warning on first occurrence.

## Security Patterns Detected

| Pattern | Trigger | Risk |
|---------|---------|------|
| GitHub Actions injection | Editing `.github/workflows/*.yml` | Command injection via untrusted event inputs |
| `child_process.exec()` | Content contains `exec(`, `execSync(` | Shell command injection |
| `new Function()` | Content contains `new Function` | Arbitrary code execution |
| `eval()` | Content contains `eval(` | Arbitrary code execution |
| `dangerouslySetInnerHTML` | Content contains `dangerouslySetInnerHTML` | Cross-site scripting (XSS) |
| `document.write()` | Content contains `document.write` | XSS and performance issues |
| `.innerHTML =` | Content contains `.innerHTML =` | XSS via untrusted HTML |
| `pickle` | Content contains `pickle` | Arbitrary code execution via deserialization |
| `os.system()` | Content contains `os.system` | Shell command injection |

## How It Works

- On first detection per file + rule combination in a session, the hook **blocks the edit** (exit code 2) and shows a warning with remediation guidance
- Subsequent edits to the same file for the same rule are allowed through (the warning is only shown once per session)
- Session state is stored in `~/.claude/security_warnings_state_<session_id>.json`
- State files older than 30 days are automatically cleaned up

## Configuration

The hook can be disabled by setting the environment variable:

```bash
export ENABLE_SECURITY_REMINDER=0
```

## Installation

Install via the plugin marketplace:

```
/plugin install security-guidance@claude-code-plugins
```

Or add to your project's `.claude/settings.json`:

```json
{
  "plugins": ["security-guidance@claude-code-plugins"]
}
```

## Requirements

- Python 3.6+
