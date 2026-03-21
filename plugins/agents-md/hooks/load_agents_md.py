#!/usr/bin/env python3
"""SessionStart hook: inject AGENTS.md files as additionalContext.

Claude Code natively reads CLAUDE.md (and CLAUDE.local.md) from the project
tree and the user's ~/.claude/ directory. Many other AI coding tools — Cursor,
OpenAI Codex, Amp, and others — use AGENTS.md for the same purpose, creating
a cross-tool standard.

This hook mirrors Claude Code's own CLAUDE.md discovery logic:
  1. Walk up from the project root, collecting every AGENTS.md found.
  2. Also check ~/.claude/AGENTS.md for user-level instructions.

All found files are concatenated and injected via additionalContext so Claude
sees them exactly as if they had been written in CLAUDE.md.

See: https://github.com/anthropics/claude-code/issues/6235
     https://agents.md/
"""

import json
import os
import sys
from pathlib import Path


FILENAME = "AGENTS.md"
# Limit how many directory levels we climb (same spirit as CLAUDE.md behaviour).
MAX_DEPTH = 20


def find_agents_md_files(start_dir: Path) -> list[Path]:
    """Walk upward from start_dir collecting AGENTS.md files (innermost first)."""
    found: list[Path] = []
    current = start_dir.resolve()

    for _ in range(MAX_DEPTH):
        candidate = current / FILENAME
        if candidate.is_file():
            found.append(candidate)
        parent = current.parent
        if parent == current:
            break  # reached filesystem root
        current = parent

    return found


def main() -> None:
    # Consume stdin (required by hook protocol).
    try:
        hook_input = json.load(sys.stdin)
    except Exception:
        hook_input = {}

    # Determine the project root. The hook runs with cwd set to the project
    # directory; fall back to CLAUDE_PROJECT_ROOT if provided.
    project_root_env = os.environ.get("CLAUDE_PROJECT_ROOT", "")
    start_dir = Path(project_root_env) if project_root_env else Path.cwd()

    # 1. Collect project-tree AGENTS.md files (closest → furthest from root).
    project_files = find_agents_md_files(start_dir)

    # 2. User-level AGENTS.md at ~/.claude/AGENTS.md (lowest priority).
    user_file = Path.home() / ".claude" / FILENAME
    user_files = [user_file] if user_file.is_file() else []

    # Final order: user-level first (lowest priority), then project files
    # from outermost → innermost (matching how CLAUDE.md precedence works).
    all_files = user_files + list(reversed(project_files))

    if not all_files:
        # Nothing to inject — exit silently.
        sys.exit(0)

    # Read and concatenate.
    sections: list[str] = []
    for path in all_files:
        try:
            content = path.read_text(encoding="utf-8").strip()
            if content:
                sections.append(
                    f"<!-- AGENTS.md: {path} -->\n{content}"
                )
        except OSError:
            pass  # Unreadable file — skip silently.

    if not sections:
        sys.exit(0)

    combined = "\n\n".join(sections)
    context = (
        "The following instructions come from AGENTS.md file(s) found in this "
        "project. AGENTS.md is a cross-tool standard (used by Cursor, Codex, "
        "Amp, and others) equivalent to CLAUDE.md. Treat these instructions "
        "with the same weight as CLAUDE.md:\n\n" + combined
    )

    output = {
        "hookSpecificOutput": {
            "hookEventName": "SessionStart",
            "additionalContext": context,
        }
    }
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
