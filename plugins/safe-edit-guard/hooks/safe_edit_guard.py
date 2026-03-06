#!/usr/bin/env python3
"""
Safe Edit Guard for Claude Code

Blocks Edit/Write on files that haven't been Read first in the current session.
Prevents the most common source of Claude Code regressions: blind edits to files
the model hasn't seen, leading to lost code, broken imports, and wrong assumptions.

Exit codes:
  0 = allow (file was read, or exempt)
  2 = block (file not read yet)
"""

import json
import os
import sys

# --- Configuration ---

# File extensions that require read-before-edit.
# Config files, markdown, etc. are allowed without reading first.
GUARDED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".rs", ".go", ".java",
    ".c", ".cpp", ".h", ".hpp", ".rb", ".php", ".sh", ".sql",
    ".swift", ".kt", ".cs", ".vue", ".svelte",
}

# Files always allowed without reading (frequently auto-generated or managed).
EXEMPT_BASENAMES = {
    "__init__.py",
    "package-lock.json",
    "yarn.lock",
    "Cargo.lock",
}


def get_tracker_path(session_id):
    """Session-scoped tracker file for read history."""
    return os.path.join("/tmp", f"safe-edit-guard-{session_id}.json")


def load_reads(session_id):
    """Load set of files Read in this session."""
    path = get_tracker_path(session_id)
    try:
        with open(path) as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_reads(session_id, reads):
    """Persist read tracker atomically."""
    path = get_tracker_path(session_id)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(sorted(reads), f)
    os.replace(tmp, path)


def normalize(filepath):
    """Resolve symlinks and normalize path for consistent matching."""
    return os.path.realpath(os.path.normpath(filepath))


def is_related(read_path, edit_path):
    """Check if a read file is related to the edit target.

    Allows editing test_foo.py if foo.py was read (and vice versa),
    or editing foo.py in a different directory if the same basename was read.
    """
    read_base = os.path.basename(read_path)
    edit_base = os.path.basename(edit_path)

    # Same file in different directory
    if read_base == edit_base:
        return True

    # Strip test prefixes/suffixes and compare stems
    read_stem = strip_test_affixes(os.path.splitext(read_base)[0])
    edit_stem = strip_test_affixes(os.path.splitext(edit_base)[0])
    return read_stem == edit_stem and read_stem != ""


def strip_test_affixes(stem):
    """Remove common test prefixes and suffixes from a filename stem."""
    s = stem.lower()
    for prefix in ("test_", "test"):
        if s.startswith(prefix):
            s = s[len(prefix):]
            break
    for suffix in ("_test", "_spec", ".test", ".spec"):
        if s.endswith(suffix):
            s = s[:-len(suffix)]
            break
    return s


def main():
    try:
        data = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        # Can't parse input — fail open to avoid blocking legitimate work
        sys.exit(0)

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    session_id = data.get("session_id", "default")

    # --- Track Read calls ---
    if tool_name == "Read":
        file_path = tool_input.get("file_path", "")
        if file_path:
            reads = load_reads(session_id)
            reads.add(normalize(file_path))
            save_reads(session_id, reads)
        sys.exit(0)

    # --- Guard Edit/Write/MultiEdit ---
    if tool_name not in ("Edit", "Write", "MultiEdit"):
        sys.exit(0)

    file_path = tool_input.get("file_path", "")
    if not file_path:
        sys.exit(0)

    file_path_norm = normalize(file_path)
    _, ext = os.path.splitext(file_path)

    # Only guard code files
    if ext.lower() not in GUARDED_EXTENSIONS:
        sys.exit(0)

    # Exempt specific files
    if os.path.basename(file_path) in EXEMPT_BASENAMES:
        sys.exit(0)

    # Allow Write to new files (creating from scratch)
    if tool_name == "Write" and not os.path.exists(file_path):
        sys.exit(0)

    # Check if file (or a related file) was read this session
    reads = load_reads(session_id)

    if file_path_norm in reads:
        sys.exit(0)

    for read_file in reads:
        if is_related(read_file, file_path_norm):
            sys.exit(0)

    # Block — file was not read
    print(
        f"Read {file_path} before editing it. "
        f"This prevents blind edits that overwrite working code.",
        file=sys.stderr,
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
