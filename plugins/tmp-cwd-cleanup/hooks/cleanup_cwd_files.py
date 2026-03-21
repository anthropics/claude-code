#!/usr/bin/env python3
"""Stop hook: clean up orphaned /tmp/claude-*-cwd files.

The Bash tool writes a small temp file to /tmp/claude-<hex>-cwd after each
command to capture the resulting working directory, but never deletes it.
On active systems these files accumulate into the thousands and eventually
slow down /tmp lookups (see issue #8856).

This hook runs on session Stop and removes any such files owned by the
current user, providing a clean-up path until the upstream fix lands.
"""

import glob
import json
import os
import sys


def main() -> None:
    # Consume stdin (required by the hook protocol) but we don't need it.
    try:
        json.load(sys.stdin)
    except Exception:
        pass

    uid = os.getuid() if hasattr(os, "getuid") else None  # no-op on Windows
    removed = 0
    errors = 0

    for path in glob.glob("/tmp/claude-*-cwd"):
        try:
            # Only remove files owned by the current user (safety check).
            if uid is not None and os.stat(path).st_uid != uid:
                continue
            if os.path.isfile(path):
                os.unlink(path)
                removed += 1
        except OSError:
            errors += 1

    # Exit 0 so the Stop event is never blocked.
    # Optionally surface a brief summary via systemMessage.
    if removed > 0:
        result = {"systemMessage": f"tmp-cwd-cleanup: removed {removed} orphaned file(s)."}
        if errors:
            result["systemMessage"] += f" ({errors} error(s) skipped)"
        print(json.dumps(result))

    sys.exit(0)


if __name__ == "__main__":
    main()
