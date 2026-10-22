#!/usr/bin/env python3
"""
Claude Code Hook: tmp-cleanup (PostToolUse)
============================================
Cleans orphaned claude-{hex}-cwd files after Bash tool execution.
Addresses GitHub Issue #8856: Missing cleanup for working directory tracking files.

Each Bash tool invocation creates a temporary file to track the working directory.
These files are never deleted by the runtime, accumulating hundreds per day.

This hook runs after each Bash tool call and removes stale files (older than
60 seconds) to prevent accumulation while preserving any file the runtime
may still need for the current command.
"""

import json
import os
import sys

try:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from cwd_file_cleanup import run_hook
except ImportError as e:
    sys.stdin.read()
    print(json.dumps({"systemMessage": f"tmp-cleanup: failed to load — {e}"}))
    sys.exit(0)

if __name__ == "__main__":
    run_hook()
