#!/usr/bin/env python3
"""
Claude Code Hook: Bash Command Validator
=========================================
This hook runs as a PreToolUse hook for the Bash tool.
It validates bash commands against a set of rules before execution.
In this case it changes grep calls to using rg.

It also demonstrates how to read the new agent context fields
(is_subagent, agent_name, parent_session_id, agent_depth) added in
Issue #36270 / #6885 to tailor messages for main agent vs subagent callers.

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
            "command": "python3 /path/to/claude-code/examples/hooks/bash_command_validator_example.py"
          }
        ]
      }
    ]
  }
}

All PreToolUse hook payloads include these agent context fields:
  - is_subagent       (bool)   True when called from a subagent
  - agent_name        (str)    Subagent name; empty string for main agent
  - parent_session_id (str)    Parent session ID; empty at top level
  - agent_depth       (int)    Nesting depth: 0 = main agent, 1 = subagent, …

"""

import json
import re
import sys

# Define validation rules as a list of (regex pattern, message) tuples
_VALIDATION_RULES = [
    (
        r"^grep\b(?!.*\|)",
        "Use 'rg' (ripgrep) instead of 'grep' for better performance and features",
    ),
    (
        r"^find\s+\S+\s+-name\b",
        "Use 'rg --files | rg pattern' or 'rg --files -g pattern' instead of 'find -name' for better performance",
    ),
]


def _validate_command(command: str) -> list[str]:
    issues = []
    for pattern, message in _VALIDATION_RULES:
        if re.search(pattern, command):
            issues.append(message)
    return issues


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        # Exit code 1 shows stderr to the user but not to Claude
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    if tool_name != "Bash":
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    if not command:
        sys.exit(0)

    # ── Agent context fields (available in all hook events) ────────────────
    # is_subagent       – True when the call originates from a subagent
    # agent_name        – Subagent name; empty string for the main agent
    # parent_session_id – Parent session ID; empty at top level
    # agent_depth       – 0 = main agent, 1 = first-level subagent, etc.
    is_subagent = input_data.get("is_subagent", False)
    agent_name = input_data.get("agent_name", "")
    agent_depth = input_data.get("agent_depth", 0)
    # parent_session_id = input_data.get("parent_session_id", "")  # available if needed

    issues = _validate_command(command)
    if issues:
        for message in issues:
            # Tailor the message prefix based on agent context
            if is_subagent:
                prefix = f"[Subagent '{agent_name or 'unknown'}' depth={agent_depth}]"
            else:
                prefix = "[Main agent]"
            print(f"{prefix} • {message}", file=sys.stderr)
        # Exit code 2 blocks tool call and shows stderr to Claude
        sys.exit(2)


if __name__ == "__main__":
    main()
