#!/usr/bin/env python3
"""PreToolUse hook for tool-mutex plugin.

Acquires a semaphore slot before filesystem-heavy tools execute.
This serializes directory enumeration operations to prevent the
Windows Wof.sys BSOD triggered by parallel NtQueryDirectoryFileEx
syscalls (see github.com/anthropics/claude-code/issues/32870).

On Windows: defaults to max 1 concurrent filesystem operation (full mutex).
On other platforms: defaults to max 4 concurrent operations (light throttling).

Configure via environment variable: CLAUDE_TOOL_MUTEX_MAX_CONCURRENT=<N>
Disable entirely: CLAUDE_TOOL_MUTEX_DISABLED=1
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
    from mutex.semaphore import acquire
except ImportError as e:
    # If imports fail, allow operation
    print(
        json.dumps({"systemMessage": f"[tool-mutex] Import error: {e}"}),
        file=sys.stdout,
    )
    sys.exit(0)


# Tools that perform heavy filesystem/directory enumeration
FS_HEAVY_TOOLS = {"Glob", "Grep", "Read", "Bash"}


def main():
    """Acquire a mutex slot before a filesystem-heavy tool executes."""
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, IOError):
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")

    # Only throttle filesystem-heavy tools
    if tool_name not in FS_HEAVY_TOOLS:
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_use_id = input_data.get("tool_use_id", "")

    # Acquire a semaphore slot (waits if at capacity)
    acquired = acquire(
        session_id=session_id,
        tool_use_id=tool_use_id,
        tool_name=tool_name,
    )

    if acquired:
        # Slot acquired, allow the tool to proceed
        sys.exit(0)
    else:
        # Timeout waiting for slot - allow anyway to avoid blocking user
        sys.exit(0)


if __name__ == "__main__":
    main()
