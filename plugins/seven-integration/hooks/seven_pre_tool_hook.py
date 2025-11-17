#!/usr/bin/env python3
"""
Seven Integration PreToolUse Hook
==================================
This hook notifies Seven about tool calls before they execute.
Seven can log, learn, and apply heuristics for policy/awareness.

Part of HEI-74: Add Seven integration hooks
"""

import json
import os
import subprocess
import sys
from datetime import datetime

# Debug log file
DEBUG_LOG_FILE = "/tmp/seven-hooks-log.txt"


def debug_log(message):
    """Append debug message to log file with timestamp."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        with open(DEBUG_LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] [PreToolUse] {message}\n")
    except Exception:
        pass  # Silently ignore logging errors


def get_git_branch():
    """Get current git branch name."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def get_repo_path():
    """Get git repository root path."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            timeout=2,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def assess_risk_level(tool_name, tool_input):
    """
    Assess risk level of tool call for Seven's awareness.

    Returns: "low" | "medium" | "high"
    """
    # High risk: tools that modify code or execute commands
    high_risk_tools = {"Edit", "Write", "MultiEdit", "Bash", "NotebookEdit"}

    # Medium risk: tools that read files or search
    medium_risk_tools = {"Read", "Grep", "Glob", "WebFetch"}

    if tool_name in high_risk_tools:
        return "high"
    elif tool_name in medium_risk_tools:
        return "medium"
    else:
        return "low"


def call_seven_route(event_data):
    """
    Call seven.route via subprocess.

    Assumes seven.route is available as a command-line tool.
    Falls back gracefully if not available.
    """
    try:
        # Attempt to call seven.route via a command
        # This assumes Seven bridge CLI is available in PATH
        result = subprocess.run(
            ["seven", "route", "--event", json.dumps(event_data)],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode == 0:
            debug_log(f"Seven route succeeded: {event_data.get('event')}")
            return True
        else:
            debug_log(f"Seven route failed (exit {result.returncode}): {result.stderr}")
            return False

    except FileNotFoundError:
        debug_log("Seven CLI not found - skipping route call")
        return False
    except subprocess.TimeoutExpired:
        debug_log("Seven route call timed out")
        return False
    except Exception as e:
        debug_log(f"Seven route error: {str(e)}")
        return False


def main():
    """Main hook function."""
    try:
        # Read input from stdin
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError as e:
        debug_log(f"JSON decode error: {e}")
        sys.exit(0)  # Allow tool to proceed even if we can't parse
    except Exception as e:
        debug_log(f"Unexpected error reading input: {e}")
        sys.exit(0)

    # Extract hook input data
    session_id = input_data.get("session_id", "unknown")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if not tool_name:
        sys.exit(0)  # No tool name, nothing to log

    # Gather context
    cwd = os.getcwd()
    branch = get_git_branch()
    repo_path = get_repo_path()
    risk_level = assess_risk_level(tool_name, tool_input)

    # Build event payload for Seven
    event_payload = {
        "event": "hook.preToolUse",
        "toolName": tool_name,
        "toolType": tool_input.get("type", tool_name),
        "repoPath": repo_path,
        "cwd": cwd,
        "args": tool_input,
        "branch": branch,
        "riskLevel": risk_level,
        "source": "HEI-74",
        "sessionId": session_id,
        "timestamp": datetime.now().isoformat(),
    }

    debug_log(f"PreToolUse event: {tool_name} (risk: {risk_level})")

    # Call Seven (fail soft - don't block on error)
    call_seven_route(event_payload)

    # Always allow tool to proceed (advisory only, no veto)
    sys.exit(0)


if __name__ == "__main__":
    main()
