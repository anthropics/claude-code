#!/usr/bin/env python3
"""Stop hook for memory-bridge plugin.

Reminds the user to run /bridge when the session context is substantial,
so learnings are consolidated before the session ends.
"""

import json
import os
import sys
import glob


def get_threshold_bytes():
    """Get context size threshold from env var (default 100KB)."""
    kb = int(os.environ.get("BRIDGE_THRESHOLD_KB", "100"))
    return kb * 1024


def get_marker_base():
    """Get the marker file base path for this session."""
    ppid = os.getppid()
    return f"/tmp/claude-bridge-{ppid}"


def is_context_substantial():
    """Check if the current session transcript exceeds the threshold."""
    threshold = get_threshold_bytes()
    home = os.path.expanduser("~")
    pattern = os.path.join(home, ".claude", "projects", "*", "*.jsonl")
    transcripts = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    if not transcripts:
        return False
    latest = transcripts[0]
    try:
        size = os.path.getsize(latest)
        return size >= threshold
    except OSError:
        return False


def main():
    try:
        # Read hook input (required even if unused)
        json.load(sys.stdin)

        marker = get_marker_base()

        # Already bridged this session
        if os.path.exists(f"{marker}-done"):
            print(json.dumps({}))
            sys.exit(0)

        # Already reminded once — don't nag
        if os.path.exists(f"{marker}-reminded"):
            print(json.dumps({}))
            sys.exit(0)

        # Check if context is substantial enough to warrant bridging
        if not is_context_substantial():
            print(json.dumps({}))
            sys.exit(0)

        # Mark as reminded so we only ask once
        open(f"{marker}-reminded", "w").close()

        # Block the stop and remind
        result = {
            "decision": "block",
            "reason": (
                "Session has substantial context. "
                "Run /bridge to consolidate learnings before exiting, "
                "then /clear to start fresh."
            ),
        }
        print(json.dumps(result))

    except Exception:
        # On any error, allow the stop — never trap the user
        print(json.dumps({}))

    finally:
        sys.exit(0)


if __name__ == "__main__":
    main()
