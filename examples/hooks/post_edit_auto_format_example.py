#!/usr/bin/env python3
"""
Claude Code Hook: Post-Edit Auto Formatter
============================================
This hook runs as a PostToolUse hook for file-editing tools (Edit, Write, MultiEdit).
After Claude edits or creates a file, it automatically runs the appropriate code
formatter based on the file extension.

For example, editing a .py file runs "black", editing a .js file runs "prettier".
If the formatter is not installed, the hook silently skips — it never blocks Claude.

You can customize the FORMATTERS dictionary below to add or change formatters.

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

Make sure to change your path to your actual script.

{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/post_edit_auto_format_example.py"
          }
        ]
      }
    ]
  }
}

"""

import json
import os
import subprocess
import sys

# Map file extensions to their formatter commands.
# Each value is a list of command-line arguments.
# The file path is appended automatically.
_FORMATTERS = {
    ".py": ["black", "--quiet"],
    ".js": ["prettier", "--write"],
    ".ts": ["prettier", "--write"],
    ".jsx": ["prettier", "--write"],
    ".tsx": ["prettier", "--write"],
    ".css": ["prettier", "--write"],
    ".json": ["prettier", "--write"],
    ".go": ["gofmt", "-w"],
    ".rs": ["rustfmt"],
}


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        # Exit code 1 shows stderr to the user but not to Claude
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    if tool_name not in ("Edit", "Write", "MultiEdit"):
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    if not file_path or not os.path.isfile(file_path):
        sys.exit(0)

    _, ext = os.path.splitext(file_path)
    formatter = _FORMATTERS.get(ext)

    if not formatter:
        sys.exit(0)

    try:
        result = subprocess.run(
            [*formatter, file_path],
            capture_output=True,
            timeout=10,
        )
        if result.returncode == 0:
            print(
                f"Auto-formatted {os.path.basename(file_path)} with {formatter[0]}",
                file=sys.stderr,
            )
        else:
            print(
                f"Formatter {formatter[0]} exited with code {result.returncode} on {os.path.basename(file_path)}",
                file=sys.stderr,
            )
    except (FileNotFoundError, OSError):
        # Formatter is not installed or not executable — skip silently
        pass
    except subprocess.TimeoutExpired:
        print(
            f"Formatter {formatter[0]} timed out on {os.path.basename(file_path)}",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
