#!/usr/bin/env python3
"""
Symlink Deny Hook for Claude Code
Security fix for CVE-2025-59829: Deny rules could be bypassed via symlinks.

This hook resolves symlinks before checking file paths against deny patterns,
preventing attackers from using symlinks to access restricted files.
"""

import json
import os
import re
import sys
from fnmatch import fnmatch


# System directories that should be blocked by default
# These match common deny rule patterns
BLOCKED_PATHS = [
    "/etc/**",
    "/etc/passwd",
    "/etc/shadow",
    "/etc/sudoers",
    "/etc/ssh/**",
    "/etc/ssl/**",
    "/root/**",
    "/var/log/**",
    "/proc/**",
    "/sys/**",
    "/boot/**",
]


def resolve_symlink_path(file_path: str) -> str:
    """Resolve symlinks in file path to get canonical path.

    Args:
        file_path: The file path that may contain symlinks

    Returns:
        The canonical path with symlinks resolved, or original path if
        resolution fails (e.g., file doesn't exist)
    """
    if not file_path:
        return file_path

    try:
        # Expand user home directory first
        expanded_path = os.path.expanduser(file_path)

        # Use realpath to resolve all symlinks and get canonical path
        resolved = os.path.realpath(expanded_path)

        return resolved
    except (OSError, ValueError):
        return file_path


def is_path_blocked(resolved_path: str, original_path: str) -> tuple:
    """Check if the resolved path matches any blocked patterns.

    Only blocks if:
    1. The path was a symlink (resolved != original)
    2. The resolved path matches a blocked pattern

    Args:
        resolved_path: The canonical path after symlink resolution
        original_path: The original path before resolution

    Returns:
        Tuple of (is_blocked: bool, reason: str)
    """
    # Only apply symlink protection if path was actually a symlink
    original_real = os.path.realpath(os.path.expanduser(original_path))
    if original_real == resolved_path:
        # Check if original was a symlink
        expanded_original = os.path.expanduser(original_path)
        if not os.path.islink(expanded_original):
            # Not a symlink, allow normal deny rule checking to handle this
            return False, ""

    # Check if resolved path matches any blocked patterns
    for pattern in BLOCKED_PATHS:
        if pattern.endswith("/**"):
            # Directory wildcard pattern
            base_dir = pattern[:-3]
            if resolved_path.startswith(base_dir + "/") or resolved_path == base_dir:
                return True, f"Symlink bypass blocked: '{original_path}' resolves to '{resolved_path}' which matches blocked pattern '{pattern}'"
        elif fnmatch(resolved_path, pattern):
            return True, f"Symlink bypass blocked: '{original_path}' resolves to '{resolved_path}' which matches blocked pattern '{pattern}'"

    return False, ""


def main():
    """Main hook function."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)  # Allow on parse error

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Only check file-related tools
    if tool_name not in ["Read", "Edit", "Write", "MultiEdit"]:
        sys.exit(0)

    # Extract file path
    file_path = tool_input.get("file_path", "")
    if not file_path:
        sys.exit(0)

    # Resolve symlinks
    resolved_path = resolve_symlink_path(file_path)

    # Check if blocked
    is_blocked, reason = is_path_blocked(resolved_path, file_path)

    if is_blocked:
        # Output denial response
        response = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny"
            },
            "systemMessage": f"Security: {reason}"
        }
        print(json.dumps(response))
        sys.exit(0)

    # Allow the operation
    sys.exit(0)


if __name__ == "__main__":
    main()
