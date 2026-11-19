#!/usr/bin/env python3
"""
Claude Code Hook: Desktop Notification on Stop
================================================
This hook runs as a Stop hook to send a desktop notification
when Claude finishes a task. Useful when you step away and want
to know when Claude is done.

Supports macOS (osascript), Linux (notify-send), and WSL.

Read more about hooks here: https://docs.anthropic.com/en/docs/claude-code/hooks

Make sure to change your path to your actual script.

{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python3 /path/to/claude-code/examples/hooks/notification_example.py"
          }
        ]
      }
    ]
  }
}

"""

import json
import platform
import shutil
import subprocess
import sys


def send_notification(title: str, message: str) -> None:
    """Send a desktop notification. Best-effort — silently fails if unsupported."""
    system = platform.system()

    try:
        if system == "Darwin":
            # macOS
            subprocess.run(
                [
                    "osascript",
                    "-e",
                    f'display notification "{message}" with title "{title}"',
                ],
                check=False,
                capture_output=True,
            )
        elif system == "Linux":
            # Linux (requires notify-send from libnotify)
            if shutil.which("notify-send"):
                subprocess.run(
                    ["notify-send", title, message],
                    check=False,
                    capture_output=True,
                )
        # Windows/other: no-op (extend as needed)
    except Exception:
        pass  # Notifications are best-effort


def main():
    # Read hook input from stdin
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        # If we can't parse input, still send a generic notification
        send_notification("Claude Code", "Task completed.")
        sys.exit(0)

    # Extract useful info from the stop event
    stop_reason = input_data.get("stop_reason", "unknown")

    send_notification(
        "Claude Code",
        f"Task finished (reason: {stop_reason}).",
    )

    # Exit code 0: allow the stop to proceed normally
    sys.exit(0)


if __name__ == "__main__":
    main()
