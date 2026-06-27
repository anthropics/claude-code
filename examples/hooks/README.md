# Hook Examples

Example [hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) for Claude Code. Copy and adapt these to your workflow.

## Available Examples

| Hook | Type | Description |
|------|------|-------------|
| [bash_command_validator_example.py](bash_command_validator_example.py) | PreToolUse | Redirects `grep` to `rg` and `find -name` to `rg --files` |
| [bash_security_hook.py](bash_security_hook.py) | PreToolUse | Blocks destructive commands, privilege escalation, credential exposure, and file-write bypass patterns |

## Installation

Add a hook to your `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/hook.py"
          }
        ]
      }
    ]
  }
}
```

## Exit Codes

| Code | Behavior |
|------|----------|
| `0` | Allow the tool call to proceed |
| `1` | Show stderr to the user (does not block) |
| `2` | Block the tool call and show stderr to Claude |
