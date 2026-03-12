# deny-with-reason

Deny tool calls with explanatory reasons so Claude understands *why* and adjusts its approach instead of retrying or working around the denial.

Addresses [#29782](https://github.com/anthropics/claude-code/issues/29782).

## The Problem

When Claude attempts a tool call and the user denies it, the model receives no context about why. This causes Claude to repeatedly attempt workarounds or similar tool calls without understanding the intent.

This plugin lets you declare deny rules with reasons in a simple config file. When Claude tries a matching tool call, it's denied and the reason is sent as a system message — so Claude immediately understands and can course-correct.

## Quick Start

1. Install the plugin in Claude Code
2. Create `.claude/deny-reasons.yaml` in your project:

```yaml
rules:
  - pattern: "Bash(pnpm *)"
    reason: "Use npm instead of pnpm — this project uses npm"
```

3. Claude will now be denied when trying `pnpm` commands and told to use `npm` instead. No back-and-forth needed.

## Pattern Syntax

Patterns use the format `ToolName(glob)`:

| Pattern | Matches |
|---------|---------|
| `Bash(pnpm *)` | Bash commands starting with "pnpm" |
| `Bash(sudo *)` | Bash commands starting with "sudo" |
| `Edit(*.env)` | Editing any file ending in .env |
| `Write(*.env)` | Writing any file ending in .env |
| `Bash(git push --force*)` | Force push commands |
| `Read(/etc/*)` | Reading files in /etc |
| `Bash` | All Bash calls (no argument filter) |

The glob uses standard `fnmatch` syntax: `*` matches anything, `?` matches one character, `[seq]` matches character sets.

### Tool Names

| Tool | Primary argument matched |
|------|-------------------------|
| `Bash` | `command` |
| `Edit`, `Write`, `MultiEdit` | `file_path` |
| `Read` | `file_path` |
| `WebFetch` | `url` |
| `WebSearch` | `query` |

## Configuration

The plugin looks for config files in this order:
1. `.claude/deny-reasons.yaml`
2. `.claude/deny-reasons.yml`
3. `.claude/deny-reasons.json`

### YAML format (requires PyYAML)

```yaml
rules:
  - pattern: "Bash(pnpm *)"
    reason: "Use npm instead of pnpm"
  - pattern: "Edit(*.env)"
    reason: "Don't modify .env files directly"
```

### JSON format (no dependencies)

```json
{
  "rules": [
    {
      "pattern": "Bash(pnpm *)",
      "reason": "Use npm instead of pnpm"
    },
    {
      "pattern": "Edit(*.env)",
      "reason": "Don't modify .env files directly"
    }
  ]
}
```

## How It Works

The plugin registers a PreToolUse hook that runs before every tool call. When a tool call matches a rule:

1. The tool call is **denied** via `permissionDecision: "deny"`
2. The reason is sent to Claude as a `systemMessage`
3. Claude sees the reason and adjusts its approach

If no config file exists or no rules match, the tool call proceeds normally.

## Comparison with Hookify

| | deny-with-reason | hookify |
|---|---|---|
| **Config** | Single YAML/JSON file | Per-rule markdown files |
| **Patterns** | Glob on tool invocation | Regex on tool input content |
| **Events** | PreToolUse only | bash, file, stop, prompt |
| **Actions** | Deny only | Warn or block |
| **Setup** | Drop a config file | `/hookify` command workflow |
| **Use case** | Simple "don't do X, do Y instead" | Complex multi-condition rules |

Use deny-with-reason for straightforward tool denial with explanations. Use [hookify](../hookify/) for complex, multi-condition rule engines.

## Requirements

- Python 3.9+
- PyYAML (optional — use JSON config format if unavailable)
