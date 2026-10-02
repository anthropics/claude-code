#!/usr/bin/env python3
"""
Claude Code Hook: Block Chained Bash Commands
=============================================
This hook runs as a PreToolUse hook for the Bash tool.
It blocks shell command chaining so Claude retries with one command per tool
call instead of asking the user to approve broad compound commands.

This is a conservative workaround for permission prompts on compound Bash
commands. It does not auto-approve anything. It only blocks commands that use
shell separators outside quotes:

- &&
- ||
- ;
- |

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

Make sure to change your path to your actual script.

{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/block_chained_bash_commands_example.py"
          }
        ]
      }
    ]
  }
}
"""

import json
import sys


_CHAIN_OPERATORS = ("&&", "||", ";", "|")


def _find_chained_operator(command: str) -> str | None:
    """Return the first shell chaining operator found outside quoted strings."""
    in_single_quote = False
    in_double_quote = False
    escaped = False
    i = 0

    while i < len(command):
        char = command[i]

        if escaped:
            escaped = False
            i += 1
            continue

        if char == "\\":
            escaped = True
            i += 1
            continue

        if char == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
            i += 1
            continue

        if char == '"' and not in_single_quote:
            in_double_quote = not in_double_quote
            i += 1
            continue

        if not in_single_quote and not in_double_quote:
            for operator in _CHAIN_OPERATORS:
                if command.startswith(operator, i):
                    return operator

        i += 1

    return None


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    if input_data.get("tool_name") != "Bash":
        sys.exit(0)

    command = input_data.get("tool_input", {}).get("command", "")
    if not command:
        sys.exit(0)

    operator = _find_chained_operator(command)
    if operator:
        print(
            "Blocked chained Bash command: "
            f"found '{operator}'. Run one command per Bash tool call so each "
            "command can be checked against permissions independently. If a "
            "command depends on a directory, run the directory change as its "
            "own Bash call first.",
            file=sys.stderr,
        )
        sys.exit(2)


if __name__ == "__main__":
    main()
