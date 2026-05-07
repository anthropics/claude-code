#!/usr/bin/env python3
"""
Claude Code Hook: Bash Command Validator
=========================================
This hook runs as a PreToolUse hook for the Bash tool.
It validates bash commands against a set of rules before execution.

There are two categories of rules:
  - Tool preference rules: suggest better alternatives (e.g. rg over grep)
  - Security rules: block dangerous commands as a defense-in-depth layer
    that catches patterns the settings.json deny list may miss
    (see https://github.com/anthropics/claude-code/issues/40730)

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

"""

import json
import re
import sys

# ── Tool preference rules ─────────────────────────────────────────────
# Suggest better alternatives for common commands.
_TOOL_PREFERENCE_RULES = [
    (
        r"^grep\b(?!.*\|)",
        "Use 'rg' (ripgrep) instead of 'grep' for better performance and features",
    ),
    (
        r"^find\s+\S+\s+-name\b",
        "Use 'rg --files | rg pattern' or 'rg --files -g pattern' instead of 'find -name' for better performance",
    ),
]

# ── Security rules ────────────────────────────────────────────────────
# Block dangerous shell patterns. Exit code 2 prevents the command from
# running and shows the message to Claude so it can self-correct.
_SECURITY_RULES = [
    # Sensitive file access via shell builtins (#40730)
    (
        r"(?:^|\s|;|&&|\|\|)\.\s+.*\.env\b",
        "Blocked: sourcing .env files can leak secrets into the shell environment",
    ),
    (
        r"(?:^|\s|;|&&|\|\|)source\s+.*\.env\b",
        "Blocked: sourcing .env files can leak secrets into the shell environment",
    ),
    # Destructive filesystem operations
    (
        r"(?:^|\s|;|&&|\|\|)rm\s+.*-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+/(?:\s|$)",
        "Blocked: 'rm -rf /' is catastrophically destructive",
    ),
    (
        r"(?:^|\s|;|&&|\|\|)rm\s+.*-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+/(?:\s|$)",
        "Blocked: 'rm -fr /' is catastrophically destructive",
    ),
    (
        r"(?:^|\s|;|&&|\|\|)chmod\s+777\s",
        "Blocked: 'chmod 777' sets world-writable permissions; use a more restrictive mode",
    ),
    # Remote code execution via pipe-to-shell
    (
        r"curl\s.*\|\s*(?:bash|sh|zsh)\b",
        "Blocked: piping curl output to a shell executes unreviewed remote code",
    ),
    (
        r"wget\s.*\|\s*(?:bash|sh|zsh)\b",
        "Blocked: piping wget output to a shell executes unreviewed remote code",
    ),
    # Git force-push to protected branches
    (
        r"git\s+push\s+.*--force(?:-with-lease)?\s.*\b(?:main|master)\b",
        "Blocked: force-pushing to main/master can destroy shared history",
    ),
    (
        r"git\s+push\s+.*\b(?:main|master)\b.*--force",
        "Blocked: force-pushing to main/master can destroy shared history",
    ),
    # Git destructive operations
    (
        r"(?:^|\s|;|&&|\|\|)git\s+reset\s+--hard\b",
        "Blocked: 'git reset --hard' discards uncommitted changes; use 'git stash' instead",
    ),
    (
        r"(?:^|\s|;|&&|\|\|)git\s+clean\s+.*-[a-zA-Z]*f",
        "Blocked: 'git clean -f' permanently deletes untracked files",
    ),
    # Sensitive credential file access
    (
        r"(?:^|\s|;|&&|\|\|)(?:cat|head|tail|less|more)\s+.*(?:\.ssh/|\.gnupg/|\.aws/credentials)",
        "Blocked: reading sensitive credential files",
    ),
]


def _validate_command(command: str) -> tuple[list[str], list[str]]:
    """Returns (blocking_issues, warning_issues)."""
    blocking = []
    warnings = []
    for pattern, message in _SECURITY_RULES:
        if re.search(pattern, command):
            blocking.append(message)
    for pattern, message in _TOOL_PREFERENCE_RULES:
        if re.search(pattern, command):
            warnings.append(message)
    return blocking, warnings


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    if tool_name != "Bash":
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    if not command:
        sys.exit(0)

    blocking, warnings = _validate_command(command)

    if blocking:
        for message in blocking:
            print(f"BLOCKED: {message}", file=sys.stderr)
        sys.exit(2)

    if warnings:
        for message in warnings:
            print(f"• {message}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
