# Hook Examples

Example hooks for [Claude Code's hook system](https://docs.anthropic.com/en/docs/claude-code/hooks).

Hooks let you run shell commands at specific points in the Claude Code lifecycle —
before or after tool use, when the session ends, or when the user submits a prompt.

## Available Examples

### `bash_command_validator_example.py`

**Event:** `PreToolUse` (matcher: `Bash`)

Validates Bash commands before they run. Blocks dangerous patterns such as
`rm -rf /` or `sudo` usage, and injects a safety reminder for commands it
allows through.

### `session_auto_title_example.py` / `session_auto_title_example.js`

**Event:** `UserPromptSubmit`

Automatically sets a descriptive session title on the first message of each new
session. Works by injecting an `additionalContext` instruction that tells Claude
to call the `mcp__happy__change_title` MCP tool (if available) or the `/rename`
slash command.

Why a hook rather than relying on the system prompt alone? MCP tool schemas are
loaded lazily in Claude Code. Injecting the instruction at the first user-message
turn is more reliable than putting it only in the system prompt.

Use the Python version (`session_auto_title_example.py`) or the JavaScript
version (`session_auto_title_example.js`) — both behave identically.

## Quick Setup

Copy a hook script to a convenient location, then reference it in
`~/.claude/settings.json` (global) or `.claude/settings.json` (project-local):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/session_auto_title_example.py"
          }
        ]
      }
    ]
  }
}
```

See the [hooks documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)
for all supported events, matcher syntax, and output formats.
