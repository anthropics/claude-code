#!/usr/bin/env python3
"""Notification hook executor for hookify plugin.

This script is called by Claude Code when notifications are sent.
It formats teammate idle notifications and other IPC messages for display.
"""

import os
import sys
import json
from datetime import datetime

# CRITICAL: Add plugin root to Python path for imports
PLUGIN_ROOT = os.environ.get('CLAUDE_PLUGIN_ROOT')
if PLUGIN_ROOT:
    parent_dir = os.path.dirname(PLUGIN_ROOT)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    if PLUGIN_ROOT not in sys.path:
        sys.path.insert(0, PLUGIN_ROOT)


def format_idle_notification(data: dict) -> str:
    """Format an idle notification for display.

    Args:
        data: The notification data containing type, from, timestamp, etc.

    Returns:
        Formatted string for display
    """
    worker_name = data.get('from', 'worker')
    timestamp = data.get('timestamp', '')

    # Format timestamp if present
    time_str = ''
    if timestamp:
        try:
            dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            time_str = dt.strftime('%H:%M:%S')
        except (ValueError, AttributeError):
            time_str = ''

    # Build the formatted output using the suggested format
    lines = [f"⏺ {worker_name}"]
    if time_str:
        lines.append(f"  ⎿ Status is idle ({time_str})")
    else:
        lines.append("  ⎿ Status is idle")

    return '\n'.join(lines)


def format_notification(notification_content: str) -> dict:
    """Parse and format a notification message.

    Args:
        notification_content: Raw notification content (may be JSON or plain text)

    Returns:
        Dict with formatted systemMessage
    """
    # Try to parse as JSON first
    try:
        data = json.loads(notification_content)

        # Check if this is an idle notification
        if isinstance(data, dict) and data.get('type') == 'idle_notification':
            formatted = format_idle_notification(data)
            return {"systemMessage": formatted}

        # Handle other notification types
        notification_type = data.get('type', '') if isinstance(data, dict) else ''

        if notification_type == 'status_update':
            worker = data.get('from', 'worker')
            status = data.get('status', 'unknown')
            return {"systemMessage": f"⏺ {worker}\n  ⎿ Status: {status}"}

        if notification_type == 'progress_update':
            worker = data.get('from', 'worker')
            progress = data.get('progress', '')
            return {"systemMessage": f"⏺ {worker}\n  ⎿ {progress}"}

        # For unknown JSON types, still try to format nicely
        if isinstance(data, dict) and 'from' in data:
            worker = data.get('from', 'worker')
            msg = data.get('message', data.get('status', 'update'))
            return {"systemMessage": f"⏺ {worker}\n  ⎿ {msg}"}

    except (json.JSONDecodeError, TypeError):
        # Not JSON, return as-is
        pass

    return {}


def main():
    """Main entry point for Notification hook."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # Get notification content
        notification = input_data.get('notification', '')

        # Also check for raw notification data in the input
        if not notification and input_data.get('type') == 'idle_notification':
            # The input itself is an idle notification
            formatted = format_idle_notification(input_data)
            result = {"systemMessage": formatted}
        elif notification:
            # Format the notification content
            result = format_notification(notification)
        else:
            # Check if the input looks like an IPC message
            if input_data.get('type') in ['idle_notification', 'status_update', 'progress_update']:
                if input_data.get('type') == 'idle_notification':
                    formatted = format_idle_notification(input_data)
                    result = {"systemMessage": formatted}
                else:
                    worker = input_data.get('from', 'worker')
                    status = input_data.get('status', input_data.get('type', 'update'))
                    result = {"systemMessage": f"⏺ {worker}\n  ⎿ {status}"}
            else:
                result = {}

        # Always output JSON
        print(json.dumps(result), file=sys.stdout)

    except Exception as e:
        error_output = {
            "systemMessage": f"Notification format error: {str(e)}"
        }
        print(json.dumps(error_output), file=sys.stdout)

    finally:
        # ALWAYS exit 0
        sys.exit(0)


if __name__ == '__main__':
    main()
