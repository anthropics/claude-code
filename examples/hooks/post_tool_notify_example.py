#!/usr/bin/env python3
"""
Claude Code Hook: Post-Tool Notification
=========================================
This hook runs as a PostToolUse hook and sends a system message to Claude
after specific tool operations complete. Useful for adding context, warnings,
or reminders based on what Claude just did.

Read more about hooks here: https://code.claude.com/docs/en/hooks

Make sure to change your path to your actual script.

{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/post_tool_notify_example.py"
          }
        ]
      }
    ]
  }
}

"""

import json
import os
import sys

# Patterns to watch for in edited files. Each entry:
# (file_pattern_substring, message_to_show)
_WATCH_PATTERNS = [
    (".env", "Reminder: .env files may contain secrets. Do not commit them."),
    ("migration", "Reminder: Run migrations locally to verify they work."),
    ("Dockerfile", "Reminder: Rebuild the Docker image to test this change."),
    ("package.json", "Reminder: Run `npm install` to update dependencies."),
    ("Gemfile", "Reminder: Run `bundle install` to update dependencies."),
]


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only process Edit and Write tools
    if tool_name not in ("Edit", "Write"):
        json.dump({}, sys.stdout)
        sys.exit(0)

    file_path = tool_input.get("file_path", "")
    if not file_path:
        json.dump({}, sys.stdout)
        sys.exit(0)

    # Check file against watch patterns
    basename = os.path.basename(file_path)
    messages = []
    for pattern, message in _WATCH_PATTERNS:
        if pattern in basename or pattern in file_path:
            messages.append(message)

    if messages:
        result = {"systemMessage": "\n".join(messages)}
        json.dump(result, sys.stdout)
    else:
        json.dump({}, sys.stdout)


if __name__ == "__main__":
    main()
