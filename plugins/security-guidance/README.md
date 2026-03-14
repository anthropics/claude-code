# Security Guidance Plugin

A Claude Code plugin that detects security vulnerability patterns in file edits and provides contextual guidance. It hooks into `Write`, `Edit`, and `MultiEdit` tool calls to check for 14 known vulnerability patterns.

## Severity Levels

Each pattern has a severity level that determines behavior:

- **block** — Prevents tool execution (exit code 2) and outputs the warning to stderr. Used for high-risk patterns that are almost always security mistakes.
- **warn** — Allows tool execution (exit code 0) and sends the warning as a `systemMessage` via JSON stdout. Used for patterns that may be intentional but warrant awareness.

## Detected Patterns

| # | Pattern | Severity | Description |
|---|---------|----------|-------------|
| 1 | `github_actions_workflow` | block | Command injection in GitHub Actions workflow files |
| 2 | `child_process_exec` | warn | `child_process.exec()` command injection |
| 3 | `new_function_injection` | warn | `new Function()` code injection |
| 4 | `eval_injection` | block | `eval()` arbitrary code execution |
| 5 | `react_dangerously_set_html` | warn | `dangerouslySetInnerHTML` XSS |
| 6 | `document_write_xss` | warn | `document.write()` XSS |
| 7 | `innerHTML_xss` | warn | `.innerHTML` assignment XSS |
| 8 | `pickle_deserialization` | warn | Python `pickle` unsafe deserialization |
| 9 | `os_system_injection` | warn | `os.system()` command injection |
| 10 | `sql_injection` | block | SQL query string concatenation/f-strings |
| 11 | `hardcoded_secrets` | block | Hardcoded API keys, passwords, private keys |
| 12 | `path_traversal` | warn | File path construction from user input |
| 13 | `insecure_deserialization` | warn | Unsafe deserialization (yaml.load, node-serialize, etc.) |
| 14 | `unsafe_deprecated_apis` | warn | MD5/SHA1 hashing, deprecated `new Buffer()` |

## Configuration

### Disabling the Plugin

Set the environment variable to disable security reminders:

```bash
export ENABLE_SECURITY_REMINDER=0
```

By default, the plugin is enabled (`ENABLE_SECURITY_REMINDER=1`).

### Deduplication

Warnings are deduplicated per session: each unique combination of file path + rule name is only shown once per session. State files are stored in `~/.claude/` and automatically cleaned up after 30 days.

## Known Limitations

- **CSRF detection**: CSRF patterns are not included because they require structural analysis beyond substring matching.
- **`Math.random()` / `escape()`**: These deprecated/insecure APIs are excluded due to high false positive rates in non-security contexts.
