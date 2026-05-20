#!/usr/bin/env python3
"""
Claude Code Hook: Permission Denied Handler
============================================
This hook runs as a PermissionDenied hook. It fires whenever Claude Code's
auto-mode classifier denies a tool call. It logs every denial to a local
audit file and selectively allows Claude to retry when the blocked tool is
read-only (safe to retry without security risk).

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

Make sure to change your path to your actual script.

{
  "hooks": {
    "PermissionDenied": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/permission_denied_retry_example.py"
          }
        ]
      }
    ]
  }
}

Return values:
  - Output {"retry": true} to stdout → Claude gets one more attempt
  - Exit with no output (or {"retry": false}) → denial is final
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Tools that are safe to retry: they only read, never mutate the filesystem.
_READ_ONLY_TOOLS = frozenset(
    [
        "Read",
        "Glob",
        "Grep",
        "LS",
        "WebSearch",
        "WebFetch",
        "NotebookRead",
    ]
)

# Append-only audit log stored next to Claude's config directory.
_LOG_PATH = Path.home() / ".claude" / "permission_denials.log"


def _log_denial(tool_name: str, tool_input: dict, will_retry: bool) -> None:
    """Append one denial record to the audit log.

    Args:
        tool_name: Name of the tool that was denied.
        tool_input: The input payload that was blocked.
        will_retry: Whether this hook is allowing a retry.
    """
    _LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    record = {
        "timestamp": timestamp,
        "tool_name": tool_name,
        "tool_input": tool_input,
        "retry_allowed": will_retry,
    }
    with _LOG_PATH.open("a", encoding="utf-8") as log_file:
        log_file.write(json.dumps(record) + "\n")


def _should_retry(tool_name: str) -> bool:
    """Return True when the denied tool is read-only and safe to retry.

    Args:
        tool_name: Name of the tool that was denied.

    Returns:
        True if the tool appears in the read-only allowlist.
    """
    return tool_name in _READ_ONLY_TOOLS


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        # Exit code 1 shows stderr to the user but not to Claude
        sys.exit(1)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    retry = _should_retry(tool_name)

    _log_denial(tool_name, tool_input, retry)

    if retry:
        # Returning {"retry": true} lets Claude try a different approach
        print(json.dumps({"retry": True}))


if __name__ == "__main__":
    main()
