# Security Guidance

A Claude Code plugin that provides real-time security warnings when editing files. It detects common vulnerability patterns and blocks unsafe changes before they're written.

## Overview

This plugin installs a `PreToolUse` hook that runs automatically when Claude uses `Edit`, `Write`, or `MultiEdit` tools. It scans file paths and content for known security anti-patterns and shows actionable warnings.

Key features:

- Detects 9 common vulnerability patterns across multiple languages
- Blocks unsafe edits with clear remediation guidance
- Session-scoped deduplication to avoid warning fatigue
- Zero configuration required

## Security Patterns

| Pattern | Trigger | Risk |
| --- | --- | --- |
| **GitHub Actions Injection** | `${{ github.event.* }}` in workflow files | Command injection via untrusted inputs |
| **child_process.exec** | `child_process.exec()`, `execSync()` | Shell injection |
| **new Function** | `new Function(...)` | Code injection via dynamic evaluation |
| **eval** | `eval(...)` | Arbitrary code execution |
| **dangerouslySetInnerHTML** | `dangerouslySetInnerHTML` in React | Cross-site scripting (XSS) |
| **document.write** | `document.write(...)` | XSS via DOM manipulation |
| **innerHTML** | `.innerHTML =` | XSS via direct HTML injection |
| **pickle** | `pickle.load()`, `pickle.loads()` | Arbitrary code execution during deserialization |
| **os.system** | `os.system()` | Command injection in Python |

## How It Works

1. Claude attempts to edit or write a file
2. The hook checks the file path and content against security patterns
3. If a match is found, the hook **blocks the edit** (exit code 2) and displays a warning with recommended alternatives
4. Warnings are shown once per file per pattern per session to reduce noise

## Configuration

The plugin is enabled by default. To disable it, set the environment variable:

```bash
export ENABLE_SECURITY_REMINDER=false
```

## Requirements

- Python 3

## License

MIT

## Author

David Dworken (dworken@anthropic.com)
