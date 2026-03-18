#!/usr/bin/env python3
"""PostToolUse hook for tool-mutex plugin.

Releases the semaphore slot after a filesystem-heavy tool completes.
This is the counterpart to pretooluse.py which acquires the slot.
"""

import os
import sys
import json

# Add plugin root to Python path for imports
PLUGIN_ROOT = os.environ.get("CLAUDE_PLUGIN_ROOT")
if PLUGIN_ROOT:
    parent_dir = os.path.dirname(PLUGIN_ROOT)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    if PLUGIN_ROOT not in sys.path:
        sys.path.insert(0, PLUGIN_ROOT)

try:
    from mutex.semaphore import release
except ImportError:
    sys.exit(0)


# Must match the set in pretooluse.py
FS_HEAVY_TOOLS = {"Glob", "Grep", "Read", "Bash"}


def main():
    """Release the mutex slot after a filesystem-heavy tool completes."""
    if os.environ.get("CLAUDE_TOOL_MUTEX_DISABLED", "0") == "1":
        sys.exit(0)

    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, IOError):
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")

    if tool_name not in FS_HEAVY_TOOLS:
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_use_id = input_data.get("tool_use_id", "")

    release(session_id=session_id, tool_use_id=tool_use_id)

    sys.exit(0)


if __name__ == "__main__":
    main()
