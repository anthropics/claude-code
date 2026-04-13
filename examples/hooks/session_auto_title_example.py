#!/usr/bin/env python3
"""
Claude Code Hook: Session Auto-Title
=====================================
This hook runs as a UserPromptSubmit hook.
On the FIRST message of each new session it injects an additionalContext
instruction that tells Claude to set a meaningful session title (via whatever
title-setting mechanism is available — e.g. /rename or an MCP tool such as
mcp__happy__change_title from the Happy app).

Without this hook, title-setting relies solely on the system prompt, which is
less reliable because MCP tool schemas are loaded lazily (deferred). Injecting
the instruction directly into the first user-message turn — the same technique
used for Codex / Gemini integrations — makes auto-titling deterministic.

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

HOW IT WORKS
------------
* Uses CLAUDE_SESSION_ID to create a tiny per-session flag file in the OS temp
  directory (/tmp on Linux/macOS, %TEMP% on Windows).
* First call  → writes flag, outputs additionalContext JSON → Claude sets title.
* Later calls → flag exists, hook exits 0 silently (no overhead).
* Flag files are cleaned up automatically by the OS on reboot.

SETUP
-----
Add to ~/.claude/settings.json (global) or .claude/settings.json (project):

{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/session_auto_title_example.py"
          }
        ]
      }
    ]
  }
}

UserPromptSubmit hooks have no "matcher" field (they always run).
"""

import json
import os
import sys
import tempfile

# Instruction injected into the model context on the first turn.
# Tells Claude to set a concise title that represents the session topic.
# If no title-setting tool is available, Claude is instructed to skip gracefully.
_TITLE_INSTRUCTION = (
    "IMPORTANT — this is the first message of a new session.\n"
    "Please set a short, descriptive session title (≤60 chars) that captures "
    "what this conversation is about.\n"
    "• If the mcp__happy__change_title tool is available: "
    "call ToolSearch with query 'select:mcp__happy__change_title', "
    "then call mcp__happy__change_title with the title.\n"
    "• Otherwise, use the /rename slash command.\n"
    "Do this alongside your first response — not after."
)


def _flag_path(session_id: str) -> str:
    """Return a per-session flag file path in the OS temp directory."""
    return os.path.join(tempfile.gettempdir(), f"cc-autotitle-{session_id}.done")


def main() -> None:
    session_id = os.environ.get("CLAUDE_SESSION_ID", "")
    if not session_id:
        # No session ID — nothing to do.
        sys.exit(0)

    flag = _flag_path(session_id)

    if os.path.exists(flag):
        # Not the first message — skip silently.
        sys.exit(0)

    # Mark this session so subsequent messages don't inject the instruction.
    try:
        # 'x' flag = exclusive create; fails if the file already exists (race-safe).
        with open(flag, "x") as fh:
            fh.write("1")
    except FileExistsError:
        # Another process beat us to it — treat as "not first message".
        sys.exit(0)

    # Output additionalContext to inject into the model's context window.
    output = {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": _TITLE_INSTRUCTION,
        }
    }
    print(json.dumps(output))


if __name__ == "__main__":
    main()
