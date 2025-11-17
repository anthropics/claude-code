#!/usr/bin/env python3
"""
Seven Integration PostToolUse Hook
===================================
This hook notifies Seven about tool execution results after they complete.
Seven uses this for temporal memory, outcome logging, and pattern learning.

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
            f.write(f"[{timestamp}] [PostToolUse] {message}\n")
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


def extract_result_summary(tool_name, tool_output):
    """
    Extract a concise summary from tool output for Seven's memory.

    Returns short text summary, or None if not applicable.
    """
    if not tool_output:
        return None

    # For string outputs, take first 200 chars
    if isinstance(tool_output, str):
        summary = tool_output[:200]
        if len(tool_output) > 200:
            summary += "..."
        return summary

    # For dict/object outputs, try to extract key info
    if isinstance(tool_output, dict):
        # Common patterns
        if "output" in tool_output:
            output = str(tool_output["output"])[:200]
            return output + ("..." if len(str(tool_output["output"])) > 200 else "")

        if "stdout" in tool_output:
            stdout = str(tool_output["stdout"])[:200]
            return stdout + ("..." if len(str(tool_output["stdout"])) > 200 else "")

        # Generic fallback
        return json.dumps(tool_output)[:200] + "..."

    return str(tool_output)[:200]


def determine_success(tool_output, tool_error):
    """
    Determine if tool execution was successful.

    Returns: (success: bool, error_message: str | None)
    """
    if tool_error:
        return False, str(tool_error)

    # If output indicates error/failure patterns
    if isinstance(tool_output, dict):
        if tool_output.get("error"):
            return False, str(tool_output.get("error"))
        if tool_output.get("exitCode") and tool_output["exitCode"] != 0:
            return False, f"Exit code: {tool_output['exitCode']}"

    # Default: success if no explicit error
    return True, None


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
        sys.exit(0)  # Allow to proceed even if we can't parse
    except Exception as e:
        debug_log(f"Unexpected error reading input: {e}")
        sys.exit(0)

    # Extract hook input data
    session_id = input_data.get("session_id", "unknown")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    tool_output = input_data.get("tool_output")
    tool_error = input_data.get("tool_error")

    if not tool_name:
        sys.exit(0)  # No tool name, nothing to log

    # Gather context
    cwd = os.getcwd()
    branch = get_git_branch()
    repo_path = get_repo_path()

    # Determine success and extract summary
    success, error_message = determine_success(tool_output, tool_error)
    result_summary = extract_result_summary(tool_name, tool_output)

    # Build event payload for Seven
    event_payload = {
        "event": "hook.postToolUse",
        "toolName": tool_name,
        "toolType": tool_input.get("type", tool_name),
        "repoPath": repo_path,
        "cwd": cwd,
        "args": tool_input,
        "branch": branch,
        "success": success,
        "errorMessage": error_message,
        "resultSummary": result_summary,
        "source": "HEI-74",
        "sessionId": session_id,
        "timestamp": datetime.now().isoformat(),
    }

    debug_log(
        f"PostToolUse event: {tool_name} (success: {success}, error: {error_message})"
    )

    # Call Seven (fail soft - don't block on error)
    call_seven_route(event_payload)

    # Always allow to proceed (advisory only)
    sys.exit(0)


if __name__ == "__main__":
    main()
