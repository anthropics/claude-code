#!/usr/bin/env python3
"""
PostToolUse hook handler for tracking file writes and command executions.

This runs after Write, Edit, and Bash tool uses to maintain state about
what files have been created and what commands have been run.
"""

import json
import re
import sys
from pathlib import Path
from typing import Any

# Add scripts directory to path for imports
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

from utils.logger import get_logger  # noqa: E402
from utils.state import SessionState  # noqa: E402


def read_hook_input() -> dict[str, Any]:
    """Read the hook input from stdin."""
    try:
        input_data = sys.stdin.read()
        if not input_data:
            return {}
        return json.loads(input_data)
    except json.JSONDecodeError:
        return {}


def is_test_command(command: str) -> bool:
    """Check if a command is running tests."""
    test_patterns = [
        r'\bnpm\s+test\b',
        r'\bnpm\s+run\s+test',
        r'\byarn\s+test\b',
        r'\bpytest\b',
        r'\bpython\s+-m\s+pytest\b',
        r'\bcargo\s+test\b',
        r'\bgo\s+test\b',
        r'\brspec\b',
        r'\bmocha\b',
        r'\bjest\b',
        r'\bvitest\b',
    ]
    command_lower = command.lower()
    return any(re.search(p, command_lower) for p in test_patterns)


def is_lint_command(command: str) -> bool:
    """Check if a command is running a linter."""
    lint_patterns = [
        r'\bnpm\s+run\s+lint\b',
        r'\byarn\s+lint\b',
        r'\beslint\b',
        r'\bruff\s+check\b',
        r'\bpylint\b',
        r'\bflake8\b',
        r'\bmypy\b',
        r'\bcargo\s+clippy\b',
        r'\bgolangci-lint\b',
        r'\brubocop\b',
    ]
    command_lower = command.lower()
    return any(re.search(p, command_lower) for p in lint_patterns)


def is_build_command(command: str) -> bool:
    """Check if a command is building the project."""
    build_patterns = [
        r'\bnpm\s+run\s+build\b',
        r'\byarn\s+build\b',
        r'\bcargo\s+build\b',
        r'\bgo\s+build\b',
        r'\bmake\b',
        r'\bmvn\s+compile\b',
        r'\bgradle\s+build\b',
        r'\btsc\b',
        r'\bwebpack\b',
        r'\bvite\s+build\b',
    ]
    command_lower = command.lower()
    return any(re.search(p, command_lower) for p in build_patterns)


def main() -> int:
    """Main entry point for the track_tool_use hook."""
    # Read hook input
    hook_input = read_hook_input()

    # Extract fields
    session_id = hook_input.get("session_id", "unknown")
    tool_name = hook_input.get("tool_name", "")
    tool_input = hook_input.get("tool_input", {})
    tool_output = hook_input.get("tool_output", {})

    logger = get_logger(debug=False)

    # Initialize session state
    state = SessionState(session_id)

    try:
        if tool_name in ("Write", "Edit"):
            # Track file operations
            file_path = tool_input.get("file_path", "")
            if file_path:
                state.add_file_written(file_path, tool_name)
                logger.debug(f"Tracked file write: {file_path}")

        elif tool_name == "Bash":
            # Track command executions
            command = tool_input.get("command", "")
            if command:
                # Get exit code from output if available
                exit_code = 0
                if isinstance(tool_output, dict):
                    exit_code = tool_output.get("exit_code", 0)
                elif isinstance(tool_output, str):
                    # Try to extract exit code from output string
                    if "exit code" in tool_output.lower():
                        try:
                            match = re.search(r'exit code[:\s]+(\d+)', tool_output.lower())
                            if match:
                                exit_code = int(match.group(1))
                        except (ValueError, AttributeError):
                            pass

                state.add_command_run(
                    command=command,
                    exit_code=exit_code,
                    is_test=is_test_command(command),
                    is_lint=is_lint_command(command),
                    is_build=is_build_command(command)
                )
                logger.debug(f"Tracked command: {command[:50]}...")

    except Exception as e:
        logger.error(f"Error tracking tool use: {str(e)}")

    # Always return success - tracking should never block tools
    return 0


if __name__ == "__main__":
    sys.exit(main())
