#!/usr/bin/env python3
"""
Accept with Feedback Hook for Claude Code

This hook intercepts permission requests and allows users to provide feedback
when accepting operations. The feedback is passed to Claude as a system message,
giving users a way to provide guidance while still approving the operation.

Usage:
1. Set pending feedback: /accept-feedback "your guidance here"
2. When a permission prompt appears, if pending feedback exists:
   - The operation is automatically approved
   - Your feedback is sent to Claude as guidance
3. Or configure always-on feedback rules in .claude/accept-feedback.json
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path


def get_config_paths():
    """Get paths for config and state files."""
    claude_dir = Path.home() / ".claude"
    project_dir = Path(os.environ.get("CLAUDE_PROJECT_DIR", "."))

    return {
        "user_config": claude_dir / "accept-feedback.json",
        "project_config": project_dir / ".claude" / "accept-feedback.json",
        "pending_feedback": claude_dir / "pending-accept-feedback.json",
    }


def load_json_file(path):
    """Load JSON from file, return empty dict if not found."""
    try:
        if path.exists():
            with open(path, "r") as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass
    return {}


def get_pending_feedback(session_id):
    """Get pending feedback for this session and clear it."""
    paths = get_config_paths()
    pending_file = paths["pending_feedback"]

    pending = load_json_file(pending_file)

    # Check for session-specific pending feedback
    if session_id in pending:
        feedback = pending[session_id]
        # Clear the pending feedback after use
        del pending[session_id]
        try:
            if pending:
                with open(pending_file, "w") as f:
                    json.dump(pending, f)
            else:
                pending_file.unlink(missing_ok=True)
        except IOError:
            pass
        return feedback.get("message"), feedback.get("one_time", True)

    return None, True


def get_configured_feedback(tool_name, tool_input):
    """Get feedback configured for this tool type."""
    paths = get_config_paths()

    # Load both user and project configs
    user_config = load_json_file(paths["user_config"])
    project_config = load_json_file(paths["project_config"])

    # Project config takes precedence
    config = {**user_config, **project_config}

    rules = config.get("rules", [])

    for rule in rules:
        # Check if rule matches this tool
        matcher = rule.get("matcher", "*")
        if matcher == "*" or tool_name in matcher.split("|"):
            # Check conditions if specified
            conditions = rule.get("conditions", {})
            matches = True

            for key, pattern in conditions.items():
                value = str(tool_input.get(key, ""))
                if pattern not in value:
                    matches = False
                    break

            if matches:
                return rule.get("feedback")

    return None


def main():
    """Main hook function."""
    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input)
    except json.JSONDecodeError:
        # Can't parse input, don't interfere
        sys.exit(0)

    session_id = input_data.get("session_id", "default")
    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    # Check for pending feedback first (from /accept-feedback command)
    pending_message, _ = get_pending_feedback(session_id)

    if pending_message:
        # We have pending feedback - approve with the feedback as system message
        result = {
            "hookSpecificOutput": {
                "permissionDecision": "allow"
            },
            "systemMessage": f"[User Feedback on Approval]: {pending_message}"
        }
        print(json.dumps(result))
        sys.exit(0)

    # Check for configured feedback rules
    configured_feedback = get_configured_feedback(tool_name, tool_input)

    if configured_feedback:
        # We have configured feedback for this tool type
        result = {
            "hookSpecificOutput": {
                "permissionDecision": "allow"
            },
            "systemMessage": f"[User Guidance]: {configured_feedback}"
        }
        print(json.dumps(result))
        sys.exit(0)

    # No feedback configured - don't interfere with the normal permission flow
    sys.exit(0)


if __name__ == "__main__":
    main()
