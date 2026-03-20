# bash-guard

A Claude Code plugin that fixes the compound-command permission bypass described in [issue #36637](https://github.com/anthropics/claude-code/issues/36637).

## The bug

Claude Code's built-in permission checker evaluates a `Bash` tool call as a single string.  When the command is a compound expression such as:

```
git status && rm -rf /important/dir
```

the checker sees the whole string, finds that `git status` matches an allow-rule prefix, and lets the command through — **without ever evaluating `rm -rf /important/dir` against the deny rules**.

The same bypass works with `;`, `||`, and `|`.

## What this plugin does

`bash-guard` registers a `PreToolUse` hook for `Bash` tool calls.  Before Claude Code executes the command, the hook:

1. **Splits** the command on `&&`, `||`, `;`, and `|` while respecting single quotes, double quotes, and backticks so that quoted operators are not treated as separators.
2. **Reads** deny patterns from `~/.claude/settings.json` and the project-local `.claude/settings.json` / `.claude/settings.local.json`.
3. **Checks each segment** independently against every `Bash(...)` deny pattern.
4. **Blocks** the entire command if any segment matches, printing a clear error message that names the offending segment and the matching deny rule.

### Example

With the deny rule `"Bash(rm -rf /*)"` in `settings.json`:

| Command | Before (bypass) | After (bash-guard) |
|---|---|---|
| `rm -rf /tmp` | ✅ Blocked by built-in check | ✅ Blocked |
| `git status && rm -rf /tmp` | ❌ **Allowed** | ✅ Blocked |
| `echo x; rm -rf ~/Documents` | ❌ **Allowed** | ✅ Blocked |
| `false \|\| rm -rf /home/user` | ❌ **Allowed** | ✅ Blocked |
| `git fetch && git status` | ✅ Allowed | ✅ Allowed |

## Installation

Add the plugin directory to the `plugins` array in your Claude Code settings or install via the Claude Code plugin system.

## Running the tests

```bash
python3 -m pytest plugins/bash-guard/tests/ -v
```

## Notes

- The hook uses a **fail-open** design: if settings cannot be parsed or an unexpected error occurs, the command is allowed through (Claude Code's built-in checks still apply).
- Single-segment commands are handled by Claude Code's built-in checker; the hook exits immediately without redundant work.
- The hook also strips leading `VAR=value` environment-variable assignments before matching, blocking env-prefix bypass attempts such as `X=1 rm -rf /`.
