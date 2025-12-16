#!/usr/bin/env python3
"""
Claude Code Hook: Fix File Permissions After Write
===================================================
This hook runs as a PostToolUse hook for the Write and Edit tools.
It fixes file permissions to respect the system's umask setting.

This addresses the issue where Claude Code's Write tool creates files with
restrictive 0600 permissions, ignoring the user's umask setting.

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

Configuration example for ~/.claude/settings.json or .claude/settings.local.json:

{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/fix_file_permissions_example.py"
          }
        ]
      }
    ]
  }
}

How it works:
- After Write or Edit tool completes, this hook runs
- Gets the file path from the tool input
- Calculates the correct permissions based on the current umask
- Applies the umask-respecting permissions to the file

For example:
- With umask 022: files become 0644 (rw-r--r--)
- With umask 002: files become 0664 (rw-rw-r--)
- With umask 077: files remain 0600 (rw-------)
"""

import json
import os
import stat
import sys


def get_umask() -> int:
    """Get the current umask value.

    We temporarily set umask to get the current value, then restore it.
    This is the standard way to read umask in Python.
    """
    current_umask = os.umask(0)
    os.umask(current_umask)
    return current_umask


def calculate_file_permissions(umask_value: int) -> int:
    """Calculate file permissions based on umask.

    Standard Unix behavior: new files start with 0666 base permissions,
    then umask is applied to remove bits.

    Args:
        umask_value: The current umask value (e.g., 0o022)

    Returns:
        The file permissions after applying umask (e.g., 0o644)
    """
    base_permissions = 0o666  # rw-rw-rw-
    return base_permissions & ~umask_value


def fix_file_permissions(file_path: str) -> dict:
    """Fix permissions for a file to respect umask.

    Args:
        file_path: Path to the file to fix

    Returns:
        Dict with status information
    """
    if not file_path:
        return {"status": "skipped", "reason": "no file path provided"}

    if not os.path.exists(file_path):
        return {"status": "skipped", "reason": "file does not exist"}

    if not os.path.isfile(file_path):
        return {"status": "skipped", "reason": "path is not a file"}

    try:
        # Get current permissions
        current_mode = stat.S_IMODE(os.stat(file_path).st_mode)

        # Calculate expected permissions based on umask
        umask_value = get_umask()
        expected_mode = calculate_file_permissions(umask_value)

        # Only change if current permissions are more restrictive than expected
        # This handles the case where Write tool sets 0600 instead of umask-based perms
        if current_mode == 0o600 and expected_mode != 0o600:
            os.chmod(file_path, expected_mode)
            return {
                "status": "fixed",
                "file": file_path,
                "old_mode": oct(current_mode),
                "new_mode": oct(expected_mode),
                "umask": oct(umask_value),
            }
        else:
            return {
                "status": "unchanged",
                "file": file_path,
                "current_mode": oct(current_mode),
                "expected_mode": oct(expected_mode),
            }

    except PermissionError as e:
        return {"status": "error", "reason": f"permission denied: {e}"}
    except OSError as e:
        return {"status": "error", "reason": f"OS error: {e}"}


def main():
    """Main entry point for the PostToolUse hook."""
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        # Exit 0 - don't block on invalid input, just log to stderr
        print(f"Warning: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")

    # Only process Write and Edit tools
    if tool_name not in ("Write", "Edit"):
        sys.exit(0)

    tool_input = input_data.get("tool_input", {})
    file_path = tool_input.get("file_path", "")

    if not file_path:
        sys.exit(0)

    result = fix_file_permissions(file_path)

    # Output result as JSON for logging/debugging
    # This will appear in the transcript when running with --debug
    if result.get("status") == "fixed":
        output = {
            "systemMessage": f"Fixed file permissions for {file_path}: {result['old_mode']} -> {result['new_mode']} (umask: {result['umask']})"
        }
        print(json.dumps(output))

    # Always exit 0 - this is a PostToolUse hook, we don't want to block
    sys.exit(0)


if __name__ == "__main__":
    main()
