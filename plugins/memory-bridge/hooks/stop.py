#!/usr/bin/env python3
"""Stop hook for memory-bridge plugin.

Advisory only: warns when context approaches auto-compaction (~1.5MB).
Claude self-monitors and suggests /bridge at natural breakpoints.
This hook is the last resort — if it fires, context management failed.
The user is always the final decision maker.
"""

import json
import os
import sys
import glob


def get_threshold_bytes():
    """Get context size threshold from env var (default 1500KB ~ 1.5MB)."""
    kb = int(os.environ.get("BRIDGE_THRESHOLD_KB", "1500"))
    return kb * 1024


def get_marker_base():
    """Get the marker file base path for this session."""
    ppid = os.getppid()
    return f"/tmp/claude-bridge-{ppid}"


def get_transcript_path(hook_input):
    """Get transcript path from hook input, fall back to glob."""
    # Prefer transcript_path from hook input
    path = hook_input.get("transcript_path")
    if path and os.path.exists(path):
        return path

    # Fall back to most recent JSONL
    home = os.path.expanduser("~")
    pattern = os.path.join(home, ".claude", "projects", "*", "*.jsonl")
    transcripts = sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)
    return transcripts[0] if transcripts else None


def is_context_critical(hook_input):
    """Check if context is approaching auto-compaction danger zone."""
    threshold = get_threshold_bytes()
    transcript = get_transcript_path(hook_input)
    if not transcript:
        return False
    try:
        return os.path.getsize(transcript) >= threshold
    except OSError:
        return False


def main():
    try:
        hook_input = json.load(sys.stdin)

        marker = get_marker_base()

        # Already bridged this session
        if os.path.exists(f"{marker}-done"):
            print(json.dumps({}))
            sys.exit(0)

        # Already reminded once — don't nag
        if os.path.exists(f"{marker}-reminded"):
            print(json.dumps({}))
            sys.exit(0)

        # Only warn when approaching auto-compaction
        if not is_context_critical(hook_input):
            print(json.dumps({}))
            sys.exit(0)

        # Mark as reminded so we only ask once
        open(f"{marker}-reminded", "w").close()

        # Advisory: warn but never block — user is the final decision maker
        print(
            "\n⚠️  Context approaching auto-compaction. "
            "Consider running /bridge to consolidate before stopping.\n",
            file=sys.stderr,
        )
        print(json.dumps({}))

    except Exception:
        # On any error, allow the stop — never trap the user
        print(json.dumps({}))

    finally:
        sys.exit(0)


if __name__ == "__main__":
    main()
