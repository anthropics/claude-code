#!/usr/bin/env python3
"""
Claude Code Hook: tmp-cleanup (Stop)
=====================================
Cleanup of stale claude-{hex}-cwd files on session exit.
Addresses GitHub Issue #8856.

Uses the same stale-threshold approach as the PostToolUse hook to avoid
deleting files that belong to other concurrent Claude Code sessions.
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
