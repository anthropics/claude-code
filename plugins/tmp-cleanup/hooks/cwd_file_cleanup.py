"""
Shared cleanup logic for tmp-cleanup hooks.
Addresses GitHub Issue #8856: Missing cleanup for claude-{hex}-cwd temp files.
"""

import glob
import json
import os
import re
import stat
import sys
import tempfile
import time

STALE_THRESHOLD_SECONDS = 60

TMP_DIR = tempfile.gettempdir()
TMP_PATTERN = os.path.join(TMP_DIR, "claude-????-cwd")
FILENAME_RE = re.compile(r"^claude-[0-9a-f]{4}-cwd$")


def cleanup_stale_cwd_files():
    """Remove claude-{4hex}-cwd files older than the threshold.

    Safety measures:
    - Uses lstat to avoid following symlinks (prevents /tmp symlink attacks)
    - Only deletes regular files (skips directories, pipes, etc.)
    - Validates filename matches exact 4-hex-char pattern
    - Skips files newer than STALE_THRESHOLD_SECONDS

    Returns:
        Number of files cleaned up.
    """
    now = time.time()
    cleaned = 0

    for filepath in glob.glob(TMP_PATTERN):
        try:
            basename = os.path.basename(filepath)
            if not FILENAME_RE.match(basename):
                continue

            st = os.lstat(filepath)
            if stat.S_ISLNK(st.st_mode) or not stat.S_ISREG(st.st_mode):
                continue

            if now - st.st_mtime > STALE_THRESHOLD_SECONDS:
                os.unlink(filepath)
                cleaned += 1
        except OSError:
            pass

    return cleaned


def run_hook():
    """Common hook entry point: consume stdin, run cleanup, output result."""
    sys.stdin.read()
    cleaned = cleanup_stale_cwd_files()
    if cleaned > 0:
        print(json.dumps({"systemMessage": f"tmp-cleanup: removed {cleaned} stale cwd file(s)"}))
    sys.exit(0)
