#!/usr/bin/env python3
"""
AGENTS.md SessionStart Hook

Reads AGENTS.md files and injects them into Claude Code's context
when no CLAUDE.md is present at the same directory level.

Behavior:
  - Walks from CWD up to filesystem root (mirrors CLAUDE.md loading order)
  - At each directory, if CLAUDE.md, .claude/CLAUDE.md, or CLAUDE.local.md
    exists, AGENTS.md is skipped at that level
  - If only AGENTS.md exists, its content is collected
  - Directories are processed root-first to match CLAUDE.md precedence
  - Returns collected content via SessionStart additionalContext
"""

import json
import os
import sys

MAX_CONTENT_LENGTH = 40000
MAX_ANCESTOR_DEPTH = 20


def _is_regular_file(path):
    """Check if path is a regular file (follows symlinks, matching CLAUDE.md behavior)."""
    try:
        return os.path.isfile(path)
    except OSError:
        return False


def get_cwd():
    """Extract CWD from hook input or environment."""
    try:
        if not sys.stdin.isatty():
            hook_input = json.load(sys.stdin)
            cwd = hook_input.get("cwd", "")
            if cwd and os.path.isabs(cwd):
                return cwd
    except (json.JSONDecodeError, OSError, ValueError):
        pass
    try:
        return os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    except OSError:
        return "/"


def has_claude_md(directory):
    """Check if any CLAUDE.md variant exists at this directory level."""
    paths = [
        os.path.join(directory, "CLAUDE.md"),
        os.path.join(directory, ".claude", "CLAUDE.md"),
        os.path.join(directory, "CLAUDE.local.md"),
    ]
    return any(_is_regular_file(p) for p in paths)


def read_agents_md(directory):
    """Read AGENTS.md files from a directory, return list of (path, content)."""
    candidates = [
        os.path.join(directory, "AGENTS.md"),
        os.path.join(directory, ".claude", "AGENTS.md"),
    ]
    results = []
    for path in candidates:
        if not _is_regular_file(path):
            continue
        try:
            file_size = os.path.getsize(path)
            if file_size > MAX_CONTENT_LENGTH:
                continue
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(MAX_CONTENT_LENGTH).strip()
            if content:
                results.append((path, content))
        except OSError:
            continue
    return results


def collect_ancestors(cwd):
    """Collect ancestor directories from CWD to root, return root-first."""
    dirs = []
    d = os.path.realpath(cwd)
    while True:
        dirs.append(d)
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    dirs.reverse()
    if len(dirs) > MAX_ANCESTOR_DEPTH:
        dirs = dirs[:1] + dirs[-(MAX_ANCESTOR_DEPTH - 1):]
    return dirs


def main():
    try:
        cwd = get_cwd()
        ancestors = collect_ancestors(cwd)

        sections = []
        for directory in ancestors:
            if has_claude_md(directory):
                continue
            for path, content in read_agents_md(directory):
                label = (
                    f"Contents of {path} "
                    f"(project instructions from AGENTS.md, "
                    f"loaded by agents-md plugin):"
                )
                sections.append(f"{label}\n\n{content}")

        if not sections:
            return

        collected = "\n\n".join(sections)

        if len(collected) > MAX_CONTENT_LENGTH:
            collected = (
                collected[:MAX_CONTENT_LENGTH]
                + "\n\n... [AGENTS.md content truncated]"
            )

        output = {
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": collected,
            }
        }
        print(json.dumps(output))
    except Exception as e:
        try:
            print(json.dumps({"systemMessage": f"agents-md plugin error: {e}"}))
        except Exception:
            pass


if __name__ == "__main__":
    main()
    sys.exit(0)
