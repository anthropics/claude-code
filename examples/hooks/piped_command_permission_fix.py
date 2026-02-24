#!/usr/bin/env python3
"""
Claude Code Hook: Piped Command Permission Fix
================================================
Workaround for https://github.com/anthropics/claude-code/issues/11775

When both commands in a piped command (e.g., `ls | awk`) are individually
whitelisted in settings.json under permissions.allow, the Plan agent still
prompts for permission. This is a regression where a security check on the
full compound command overrides per-segment validation.

This PermissionRequest hook intercepts Bash permission prompts, checks if the
command is a simple pipeline where each segment's base command is in an allowed
list, and auto-approves if all segments match.

Installation
------------
Add to your .claude/settings.json or .claude/settings.local.json:

{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/piped_command_permission_fix.py"
          }
        ]
      }
    ]
  }
}

Configuration
-------------
Edit ALLOWED_PREFIXES below to match the command prefixes you have whitelisted
in your permissions.allow rules. For example, if your settings include:

  "permissions": { "allow": ["Bash(ls:*)", "Bash(awk:*)"] }

Then set: ALLOWED_PREFIXES = {"ls", "awk"}
"""

import json
import shlex
import sys

# ============================================================================
# CONFIGURE THIS: Set of command prefixes that are individually whitelisted
# in your permissions.allow rules. Add any commands you have allowed via
# Bash(<command>:*) rules.
# ============================================================================
ALLOWED_PREFIXES: set[str] = {
    "ls",
    "awk",
    "grep",
    "egrep",
    "fgrep",
    "cat",
    "head",
    "tail",
    "sort",
    "wc",
    "cut",
    "tr",
    "sed",
    "find",
    "xargs",
    "echo",
    "printf",
    "tee",
    "uniq",
    "diff",
    "comm",
    "paste",
    "column",
    "basename",
    "dirname",
    "realpath",
    "stat",
    "file",
    "du",
    "df",
    "date",
    "env",
    "which",
    "whoami",
    "id",
    "uname",
    "strings",
    "od",
    "hexdump",
    "xxd",
    "jq",
    "yq",
    "rg",
    "ag",
    "tree",
}

# Characters/patterns that indicate the command is more complex than a
# simple pipeline and should go through normal security review.
DANGEROUS_PATTERNS = ["&&", "||", "$(", "`", ";", "<<"]


def is_simple_pipeline(command: str) -> bool:
    """Check if a command is a simple pipeline (only pipes, no other operators)."""
    for pattern in DANGEROUS_PATTERNS:
        if pattern in command:
            return False
    return "|" in command


def extract_base_command(segment: str) -> str | None:
    """Extract the base command from a pipe segment."""
    segment = segment.strip()
    if not segment:
        return None

    # Handle env var prefixes like FOO=bar cmd
    parts = segment.split()
    for part in parts:
        if "=" in part and not part.startswith("-"):
            continue
        return part

    return None


def all_segments_allowed(command: str) -> bool:
    """Check if all pipe segments have allowed base commands."""
    segments = command.split("|")

    for segment in segments:
        base_cmd = extract_base_command(segment)
        if base_cmd is None:
            return False
        if base_cmd not in ALLOWED_PREFIXES:
            return False

    return True


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    if tool_name != "Bash":
        # Not a Bash command, let normal flow handle it
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    command = tool_input.get("command", "")

    if not command:
        sys.exit(0)

    # Only handle simple pipelines
    if not is_simple_pipeline(command):
        sys.exit(0)

    # Check if all pipe segments have allowed base commands
    if all_segments_allowed(command):
        # All segments are individually allowed - auto-approve
        result = {
            "hookSpecificOutput": {
                "hookEventName": "PermissionRequest",
                "decision": {
                    "behavior": "allow",
                    "updatedInput": tool_input,
                },
            }
        }
        json.dump(result, sys.stdout)
        sys.exit(0)

    # Not all segments are allowed, let normal permission flow handle it
    sys.exit(0)


if __name__ == "__main__":
    main()
