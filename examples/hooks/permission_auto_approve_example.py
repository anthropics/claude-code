#!/usr/bin/env python3
"""
Claude Code Hook: Permission Auto-Approve
==========================================
This hook runs as a PreToolUse hook to auto-approve known-safe tools
without prompting the user. Tools not in the allow list fall through
to the normal permission prompt.

Read more about hooks here: https://code.claude.com/docs/en/hooks

Make sure to change your path to your actual script.

{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/permission_auto_approve_example.py"
          }
        ]
      }
    ]
  }
}

"""

import json
import re
import sys

# Tools to auto-approve. Each entry is a regex matched against tool_name.
# Customize this list to fit your workflow.
_ALLOWED_TOOLS = [
    r"^Read$",          # Reading files is always safe
    r"^Glob$",          # File pattern matching is safe
    r"^Grep$",          # Searching file contents is safe
    r"^Bash\(git ",     # Git read commands (git status, git log, git diff)
    r"^Bash\(gh ",      # GitHub CLI commands
]

# Tools to always deny. Matched before the allow list.
_DENIED_TOOLS = [
    r"^Bash\(rm -rf /",   # Never allow recursive delete from root
]


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Build a descriptor for matching (e.g., "Bash(git status)")
    descriptor = tool_name
    if tool_name == "Bash" and "command" in tool_input:
        descriptor = f"Bash({tool_input['command']})"

    # Check deny list first
    for pattern in _DENIED_TOOLS:
        if re.search(pattern, descriptor):
            result = {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                },
                "systemMessage": f"Blocked by auto-approve hook: {descriptor}",
            }
            json.dump(result, sys.stdout)
            sys.exit(0)

    # Check allow list
    for pattern in _ALLOWED_TOOLS:
        if re.search(pattern, descriptor):
            result = {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "allow",
                }
            }
            json.dump(result, sys.stdout)
            sys.exit(0)

    # Not in either list - fall through to normal permission prompt
    json.dump({}, sys.stdout)


if __name__ == "__main__":
    main()
