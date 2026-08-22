#!/usr/bin/env python3
"""
Claude Code Hook: Deny Path Guard
===================================
PreToolUse hook for Bash and Glob tools that enforces deny rules
on paths that would otherwise be accessible through recursive grep
or glob expansion.

Background: Permission deny rules correctly block Read and Grep from
accessing denied directories, but Bash commands like `grep -r` from a
parent directory and Glob patterns like `denied/**/*` can still leak
file contents and filenames. This hook closes that gap.

See: https://github.com/anthropics/claude-code/issues/28008

Configuration (add to .claude/settings.local.json):

{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Glob",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/deny_path_guard.py"
          }
        ]
      }
    ]
  }
}

Set the CLAUDE_DENY_PATHS environment variable to a colon-separated list
of denied directory paths (absolute or relative to project root):

  export CLAUDE_DENY_PATHS="docs/private:secrets:.env.d"

Or create a .claude-deny file in your project root with one path per line:

  docs/private
  secrets
  .env.d

"""

import json
import os
import re
import sys
from pathlib import Path


def load_deny_paths() -> list[str]:
    """Load denied paths from env var or .claude-deny file."""
    paths = []

    # From environment variable
    env_paths = os.environ.get("CLAUDE_DENY_PATHS", "")
    if env_paths:
        paths.extend(p.strip() for p in env_paths.split(":") if p.strip())

    # From .claude-deny file in project root
    deny_file = Path(".claude-deny")
    if deny_file.exists():
        for line in deny_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                paths.append(line)

    return paths


def normalize_path(p: str) -> str:
    """Normalize a path for comparison, resolving ~ and making absolute."""
    expanded = os.path.expanduser(p)
    if os.path.isabs(expanded):
        return os.path.normpath(expanded)
    return os.path.normpath(expanded)


def path_touches_denied(target: str, denied: list[str]) -> str | None:
    """Check if a target path overlaps with any denied path.

    Returns the denied path if there's a match, None otherwise.
    A match happens when:
    - target is inside denied (e.g. target=docs/private/secret.txt, denied=docs/private)
    - target is a parent of denied (e.g. target=docs, denied=docs/private)
      This catches recursive operations that would descend into denied dirs.
    """
    target_norm = normalize_path(target)
    for deny in denied:
        deny_norm = normalize_path(deny)
        # target is inside denied dir
        if target_norm == deny_norm or target_norm.startswith(deny_norm + os.sep):
            return deny
        # target is parent of denied dir (recursive ops would reach it)
        if deny_norm.startswith(target_norm + os.sep):
            return deny
    return None


def check_bash_command(command: str, deny_paths: list[str]) -> str | None:
    """Check if a bash command might access denied paths.

    Looks for:
    - grep/rg with -r/-R/--recursive flags
    - find commands
    - ls/cat/head/tail with denied paths
    - Any command with a denied path as argument
    """
    # Extract paths that appear in the command
    # Check if any denied path appears as a substring in the command
    for deny in deny_paths:
        deny_norm = normalize_path(deny)
        # Direct reference to denied path
        if deny in command or deny_norm in command:
            return deny

    # Check for recursive commands that start from a parent of a denied path
    recursive_patterns = [
        r"grep\s+.*-[a-zA-Z]*[rR]",  # grep -r, grep -rn, etc.
        r"grep\s+.*--recursive",
        r"rg\s+",                      # ripgrep is recursive by default
        r"find\s+",
        r"ag\s+",                      # silver searcher
        r"ack\s+",
    ]

    is_recursive = any(re.search(p, command) for p in recursive_patterns)
    if not is_recursive:
        return None

    # Extract path-like arguments from the command
    # Split on spaces, ignoring quoted strings roughly
    tokens = command.split()
    for token in tokens:
        # Skip flags
        if token.startswith("-"):
            continue
        # Skip common non-path arguments (patterns, etc.)
        if not ("/" in token or "." in token or token == "."):
            continue
        match = path_touches_denied(token, deny_paths)
        if match:
            return match

    return None


def check_glob_pattern(pattern: str, deny_paths: list[str]) -> str | None:
    """Check if a glob pattern would list files in denied directories."""
    for deny in deny_paths:
        deny_norm = normalize_path(deny)
        pattern_norm = normalize_path(pattern.split("*")[0].rstrip("/"))
        # Glob starts inside denied dir
        if pattern_norm == deny_norm or pattern_norm.startswith(deny_norm + os.sep):
            return deny
        # Glob starts from parent of denied dir with ** (would descend into it)
        if "**" in pattern and deny_norm.startswith(pattern_norm + os.sep):
            return deny
        # Direct substring match
        if deny in pattern:
            return deny
    return None


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    deny_paths = load_deny_paths()
    if not deny_paths:
        sys.exit(0)

    matched = None

    if tool_name == "Bash":
        command = tool_input.get("command", "")
        if command:
            matched = check_bash_command(command, deny_paths)

    elif tool_name == "Glob":
        pattern = tool_input.get("pattern", "")
        if pattern:
            matched = check_glob_pattern(pattern, deny_paths)

    if matched:
        print(
            f"Blocked: this operation would access '{matched}' which is in the deny list. "
            f"Recursive commands and glob patterns must respect the same deny rules as Read and Grep.",
            file=sys.stderr,
        )
        # Exit code 2 blocks the tool call and shows stderr to Claude
        sys.exit(2)


if __name__ == "__main__":
    main()
