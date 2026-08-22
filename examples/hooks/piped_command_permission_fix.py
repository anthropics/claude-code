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

Allowed commands are automatically read from Bash() permission rules in:
  ~/.claude/settings.json
  ~/.claude/settings.local.json
  .claude/settings.json
  .claude/settings.local.json

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
"""

import json
import re
import sys
from pathlib import Path

# Characters/patterns that indicate the command is more complex than a
# simple pipeline and should go through normal security review.
DANGEROUS_PATTERNS = ["&&", "||", "$(", "`", ";", "<<"]

# Regex to extract the command name from Bash() permission rules.
# Matches patterns like: Bash(cmd:*), Bash(cmd:args), Bash(cmd)
_BASH_RULE_RE = re.compile(r"^Bash\(([^:)]+)")


def load_allowed_prefixes() -> set[str]:
    """Load allowed command prefixes from Claude settings files."""
    prefixes: set[str] = set()

    settings_paths = [
        Path.home() / ".claude" / "settings.json",
        Path.home() / ".claude" / "settings.local.json",
        Path(".claude") / "settings.json",
        Path(".claude") / "settings.local.json",
    ]

    for path in settings_paths:
        try:
            data = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError):
            continue

        for rule in data.get("permissions", {}).get("allow", []):
            m = _BASH_RULE_RE.match(rule)
            if m:
                prefixes.add(m.group(1))

    return prefixes


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


def all_segments_allowed(command: str, allowed: set[str]) -> bool:
    """Check if all pipe segments have allowed base commands."""
    segments = command.split("|")

    for segment in segments:
        base_cmd = extract_base_command(segment)
        if base_cmd is None:
            return False
        if base_cmd not in allowed:
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

    allowed = load_allowed_prefixes()
    if not allowed:
        sys.exit(0)

    # Check if all pipe segments have allowed base commands
    if all_segments_allowed(command, allowed):
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
