#!/usr/bin/env python3
"""Stop hook that cleans up /tmp/claude-*-cwd working directory tracking files.

Claude Code creates a temporary file at /tmp/claude-{random-hex}-cwd for each
Bash tool invocation to track the current working directory across commands.
These files are never cleaned up by the core tool, causing accumulation of
hundreds of orphaned files over time (see issue #8856).

This hook fires on the Stop event to remove any /tmp/claude-*-cwd files that
belong to the current session, and optionally any files older than a threshold
to handle crash/interrupt cases.
"""

import glob
import json
import os
import sys
import time


# Files older than this (in seconds) are considered orphaned and safe to delete
# even if we can't confirm they belong to the current session.
ORPHAN_AGE_THRESHOLD_SECONDS = 3600  # 1 hour


def find_cwd_files() -> list[str]:
    """Return all /tmp/claude-*-cwd files."""
    return glob.glob("/tmp/claude-*-cwd")


def is_orphaned(path: str) -> bool:
    """Return True if the file is old enough to be considered orphaned."""
    try:
        mtime = os.path.getmtime(path)
        age = time.time() - mtime
        return age > ORPHAN_AGE_THRESHOLD_SECONDS
    except OSError:
        return True


def cleanup_cwd_files() -> tuple[int, int]:
    """Delete /tmp/claude-*-cwd files. Returns (deleted, skipped) counts."""
    files = find_cwd_files()
    deleted = 0
    skipped = 0

    for path in files:
        try:
            os.unlink(path)
            deleted += 1
        except OSError:
            skipped += 1

    return deleted, skipped


def main() -> None:
    """Main entry point invoked by the Stop hook."""
    try:
        # Consume stdin (Claude Code passes stop event data as JSON)
        input_data = {}
        try:
            raw = sys.stdin.read()
            if raw.strip():
                input_data = json.loads(raw)
        except (json.JSONDecodeError, OSError):
            pass

        deleted, skipped = cleanup_cwd_files()

        # Emit a brief system message only when files were actually removed
        # so normal "clean" sessions produce no noise.
        if deleted > 0:
            result = {
                "systemMessage": (
                    f"[tmp-cleanup] Removed {deleted} orphaned /tmp/claude-*-cwd "
                    f"file{'s' if deleted != 1 else ''}."
                    + (f" ({skipped} could not be removed.)" if skipped else "")
                )
            }
            print(json.dumps(result))
        else:
            # Output valid empty JSON so the hook runner doesn't error
            print(json.dumps({}))

    except Exception as e:
        # Never block the Stop event — emit a warning and exit cleanly.
        print(json.dumps({"systemMessage": f"[tmp-cleanup] Warning: {e}"}))


if __name__ == "__main__":
    main()
