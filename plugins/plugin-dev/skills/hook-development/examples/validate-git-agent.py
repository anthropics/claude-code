#!/usr/bin/env python3
"""
Claude Code Hook: Agent-Aware Git Command Validator
====================================================
Demonstrates using the `agent_id` and `agent_type`
fields (added natively in Claude Code) to enforce a security
policy: only the designated @git-expert subagent may run git commands.

Hook configuration (.claude/settings.json):
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/validate-git-agent.py"
          }
        ]
      }
    ]
  }
}

Backward compatibility note:
  If `agent_type` is absent from the payload (older Claude Code builds),
  the hook falls back to inspecting the session transcript, using the
  workaround documented in Issue #6885 comment by @coygeek.
"""

import json
import sys
from pathlib import Path

# The only agent authorized to run git commands
AUTHORIZED_GIT_AGENT = "git-expert"


# ─── Transcript fallback (for older Claude Code versions) ────────────────────

def find_agent_in_transcript(transcript_path: str) -> str | None:
    """
    Fallback: parse the JSONL transcript to infer the most recently
    invoked subagent when native `agent_type` is unavailable.

    Returns the agent name string, or None if no Task tool call is found.
    """
    try:
        lines = Path(transcript_path).read_text(encoding="utf-8").splitlines()
    except OSError:
        return None

    for line in reversed(lines):
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue

        if msg.get("type") != "assistant":
            continue

        content = msg.get("message", {}).get("content", [])
        if not isinstance(content, list):
            continue

        for item in content:
            if item.get("type") == "tool_use" and item.get("name") == "Task":
                description = item.get("input", {}).get("description", "")
                if f"@{AUTHORIZED_GIT_AGENT}" in description:
                    return AUTHORIZED_GIT_AGENT
                # Found a Task call for a different agent
                return "other-agent"

    return None  # No agent context detected


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"Hook error: invalid JSON input — {exc}", file=sys.stderr)
        sys.exit(1)

    # Only validate Bash tool calls
    if data.get("tool_name") != "Bash":
        sys.exit(0)

    command: str = data.get("tool_input", {}).get("command", "")
    if not command.startswith("git"):
        sys.exit(0)  # Not a git command — not our concern

    # ── Read agent context fields ──────────────────────────────────────────
    agent_id: str | None = data.get("agent_id")
    agent_type: str      = data.get("agent_type", "")
    is_subagent: bool    = bool(agent_id)
    transcript_path: str     = data.get("transcript_path", "")

    # ── Resolve agent name (with transcript fallback) ─────────────────────
    resolved_name = agent_type
    used_fallback = False

    if is_subagent and not agent_type and transcript_path:
        # Older Claude Code: agent_type not yet in payload — use transcript
        resolved_name = find_agent_in_transcript(transcript_path) or "unknown"
        used_fallback = True

    # ── Policy evaluation ─────────────────────────────────────────────────
    if not is_subagent:
        # Main agent must not run git commands directly
        print(
            "Security policy: the main agent must not run git commands directly.\n"
            f"Delegate '{command}' to the @{AUTHORIZED_GIT_AGENT} subagent.",
            file=sys.stderr,
        )
        sys.exit(2)

    if resolved_name != AUTHORIZED_GIT_AGENT:
        context = f"agent='{resolved_name}'"
        if used_fallback:
            context += " (inferred from transcript)"

        print(
            f"Security policy violation [{context}]:\n"
            f"Only the @{AUTHORIZED_GIT_AGENT} subagent may run git commands.\n"
            f"Attempted command: {command}",
            file=sys.stderr,
        )
        sys.exit(2)

    # Authorized — allow the git command
    sys.exit(0)


if __name__ == "__main__":
    main()
