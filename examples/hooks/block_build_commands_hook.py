#!/usr/bin/env python3
"""
Claude Code Hook: Block Build Commands
=======================================
PreToolUse hook for the Bash tool that blocks build/compilation commands
from executing. This provides a hard execution guardrail — exit code 2
prevents the tool call entirely, regardless of what the model plans.

Use case: projects where Claude should never run build processes
(cmake, make, npm build, gradle, etc.), even if the model attempts to.

Usage:

1. Save this script somewhere on your filesystem (e.g., alongside your project).
2. Add to your settings.json or managed-settings.json:

   {
     "hooks": {
       "PreToolUse": [
         {
           "matcher": "Bash",
           "hooks": [
             {
               "type": "command",
               "command": "python3 /path/to/block_build_commands_hook.py"
             }
           ]
         }
       ]
     }
   }

How it works:
- Exit code 0: allow the command (no match)
- Exit code 1: show stderr to user but allow (soft warning)
- Exit code 2: block the tool call, show stderr to Claude (hard block)

See: https://docs.anthropic.com/en/docs/claude-code/hooks
"""

import json
import re
import sys

BLOCKED_PATTERNS = [
    (r"\bcmake\b", "cmake is blocked by project policy — no build commands allowed"),
    (r"\bmake\b", "make is blocked by project policy — no build commands allowed"),
    (r"\bninja\b", "ninja is blocked by project policy — no build commands allowed"),
    (r"\bgradle\b", "Gradle is blocked by project policy — no build commands allowed"),
    (r"\bmvn?\b", "Maven is blocked by project policy — no build commands allowed"),
    (r"\bnpm\s+run\s+(build|compile)", "npm build/compile is blocked by project policy"),
    (r"\byarn\s+(build|compile)\b", "yarn build/compile is blocked by project policy"),
    (r"\bpnpm\s+(build|compile)\b", "pnpm build/compile is blocked by project policy"),
    (r"\bgcc\b", "gcc is blocked by project policy — no compilation allowed"),
    (r"\bg\+\+\b", "g++ is blocked by project policy — no compilation allowed"),
    (r"\bclang\b", "clang is blocked by project policy — no compilation allowed"),
    (r"\bcargo\s+(build|check)\b", "Cargo build/check is blocked by project policy"),
    (r"\bgo\s+build\b", "Go build is blocked by project policy"),
    (r"\bdotnet\s+build\b", "dotnet build is blocked by project policy"),
]


def check_command(command: str) -> str | None:
    for pattern, message in BLOCKED_PATTERNS:
        if re.search(pattern, command, re.IGNORECASE):
            return message
    return None


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

    message = check_command(command)
    if message:
        print(f"• {message}", file=sys.stderr)
        sys.exit(2)  # Hard block: tool call is prevented


if __name__ == "__main__":
    main()
