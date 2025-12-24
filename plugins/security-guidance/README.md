# Security Guidance Plugin

A PreToolUse hook that monitors file edits for common security vulnerabilities and warns about potential risks before changes are made.

## Overview

This plugin helps catch security issues early by detecting patterns in code changes that could introduce vulnerabilities. When a risky pattern is detected, it blocks the edit and displays a detailed security warning with guidance on safer alternatives.

## Security Patterns Detected

| Pattern | Files/Content | Risk |
|---------|---------------|------|
| **GitHub Actions Injection** | `.github/workflows/*.yml` | Command injection via untrusted inputs |
| **child_process.exec** | `exec()`, `execSync()` | Shell command injection |
| **new Function()** | Dynamic code construction | Code injection |
| **eval()** | Arbitrary code execution | Code injection |
| **dangerouslySetInnerHTML** | React unsafe HTML | XSS vulnerabilities |
| **document.write()** | Direct DOM writing | XSS vulnerabilities |
| **innerHTML assignment** | `.innerHTML =` | XSS vulnerabilities |
| **pickle** | Python serialization | Arbitrary code execution |
| **os.system** | Python shell commands | Command injection |

## How It Works

1. **Triggers on**: `Edit`, `Write`, and `MultiEdit` tool calls
2. **Checks**: File path and content for security patterns
3. **Action**: Blocks the tool if a pattern matches (first time per file/rule per session)
4. **Output**: Displays detailed warning with remediation guidance

## Configuration

The plugin is enabled by default. To disable:

```bash
export ENABLE_SECURITY_REMINDER=0
```

## Warning Behavior

- Warnings are **session-scoped**: Each unique file+rule combination only warns once per session
- After the first warning, subsequent edits to the same file with the same pattern will proceed
- State files are automatically cleaned up after 30 days

## Example Warnings

### GitHub Actions Workflow

When editing `.github/workflows/*.yml`:

```
You are editing a GitHub Actions workflow file. Be aware of these security risks:

1. **Command Injection**: Never use untrusted input directly in run: commands
2. **Use environment variables**: Instead of ${{ github.event.issue.title }}, use env:

Example of SAFE pattern:
env:
  TITLE: ${{ github.event.issue.title }}
run: echo "$TITLE"
```

### child_process.exec

When using `exec()` in JavaScript/TypeScript:

```
⚠️ Security Warning: Using child_process.exec() can lead to command injection.

Instead of:
  exec(`command ${userInput}`)

Use:
  import { execFileNoThrow } from '../utils/execFileNoThrow.js'
  await execFileNoThrow('command', [userInput])
```

## Installation

This plugin is included in the Claude Code repository. The hook is automatically active when the plugin is installed.

## Debug Logging

Debug logs are written to `/tmp/security-warnings-log.txt` for troubleshooting.

## Author

David Dworken (dworken@anthropic.com)

## Version

1.0.0
