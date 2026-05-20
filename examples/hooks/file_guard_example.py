#!/usr/bin/env python3
"""
Claude Code Hook: File Guard
==============================
This hook runs as a PreToolUse hook for file editing tools (Edit, Write, MultiEdit).
It prevents writes to sensitive files like environment configs, private keys,
and credential files.

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

Make sure to change your path to your actual script.

{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/file_guard_example.py"
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

# Patterns for files that should be protected from edits.
# Each entry is a (regex pattern, description) tuple.
_PROTECTED_PATTERNS = [
    (r"\.env($|\.)", "Environment configuration file (may contain secrets)"),
    (r"\.pem$", "PEM certificate/key file"),
    (r"\.key$", "Private key file"),
    (r"credentials\.", "Credentials file"),
    (r"\.secret", "Secret file"),
    (r"id_rsa", "SSH private key"),
    (r"id_ed25519", "SSH private key"),
]


def _check_file_path(file_path: str) -> str | None:
    """Check if the file path matches any protected pattern. Returns description if matched."""
    for pattern, description in _PROTECTED_PATTERNS:
        if re.search(pattern, file_path):
            return description
    return None


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    if tool_name not in ("Edit", "Write", "MultiEdit"):
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    if not file_path:
        sys.exit(0)

    description = _check_file_path(file_path)
    if description:
        print(
            f"Blocked: {description}\n"
            f"File: {file_path}\n"
            f"Edit this file manually if you need to make changes.",
            file=sys.stderr,
        )
        # Exit code 2 blocks the tool call and shows stderr to Claude
        sys.exit(2)


if __name__ == "__main__":
    main()
