# Security Guidance Plugin

A `PreToolUse` hook that warns about potential security vulnerabilities when editing files.

## What it does

Before Claude writes or edits a file, this hook scans the content for known dangerous patterns and surfaces a targeted warning with safer alternatives.

Patterns monitored:

| Pattern | Risk |
|---------|------|
| `child_process.exec()` | Command injection |
| `new Function()` | Code injection |
| `eval()` | Arbitrary code execution |
| `dangerouslySetInnerHTML` | XSS |
| `document.write` | XSS |
| `.innerHTML =` | XSS |
| `pickle` (Python) | Arbitrary code execution |
| `os.system` (Python) | Command injection |
| GitHub Actions workflow files | Workflow injection |

Each warning fires **once per session per pattern** to avoid noise.

## How it works

The hook runs on `Edit`, `Write`, and `MultiEdit` tool calls. It checks the file path and new content against the patterns above. When a match is found, Claude receives a contextual reminder before proceeding.

## Usage

Once installed, the hook activates automatically. No configuration needed.

To disable warnings, set the environment variable:

```bash
export ENABLE_SECURITY_REMINDER=0
```

## Debug logging

Warnings are logged to `/tmp/security-warnings-log.txt` for troubleshooting.
