#!/usr/bin/env python3
"""PreToolUse hook for deny-with-reason plugin.

Reads .claude/deny-reasons.yaml (or .json) and denies tool calls
matching configured patterns, sending the reason to Claude as a
system message so it understands why and can adjust its approach.
"""

import fnmatch
import json
import os
import sys
from pathlib import Path
from typing import Any, Optional

CONFIG_FILENAMES = [
    ".claude/deny-reasons.yaml",
    ".claude/deny-reasons.yml",
    ".claude/deny-reasons.json",
]

# Maps tool names to their primary matchable argument field
_TOOL_PRIMARY_ARG: dict[str, str] = {
    "Bash": "command",
    "Edit": "file_path",
    "Write": "file_path",
    "MultiEdit": "file_path",
    "Read": "file_path",
    "WebFetch": "url",
    "WebSearch": "query",
    "NotebookRead": "notebook_path",
    "NotebookEdit": "notebook_path",
}


def load_config(cwd: Path) -> Optional[dict[str, Any]]:
    """Load deny-reasons config from .claude/ directory.

    Tries YAML files first (requires PyYAML), then JSON.
    Returns None if no config file found or on parse error.
    """
    for filename in CONFIG_FILENAMES:
        config_path = cwd / filename
        if not config_path.exists():
            continue

        if config_path.suffix in (".yaml", ".yml"):
            try:
                import yaml  # type: ignore[import-untyped]
            except ImportError:
                continue
            try:
                with open(config_path) as f:
                    return yaml.safe_load(f)
            except Exception:
                return None
        else:
            try:
                with open(config_path) as f:
                    return json.load(f)
            except Exception:
                return None
    return None


def parse_pattern(pattern: str) -> tuple[str, str]:
    """Parse a pattern like 'Bash(pnpm *)' into (tool_name, glob).

    If no parentheses, returns (pattern, '*') to match all calls to that tool.

    Examples:
        'Bash(pnpm *)'  -> ('Bash', 'pnpm *')
        'Edit(*.env)'   -> ('Edit', '*.env')
        'Bash'          -> ('Bash', '*')
    """
    if "(" in pattern and pattern.endswith(")"):
        paren_idx = pattern.index("(")
        tool = pattern[:paren_idx].strip()
        glob = pattern[paren_idx + 1 : -1].strip()
        return tool, glob
    return pattern.strip(), "*"


def get_primary_arg(tool_name: str, tool_input: dict[str, Any]) -> str:
    """Extract the primary matchable argument for a tool call."""
    arg_key = _TOOL_PRIMARY_ARG.get(tool_name)
    if arg_key:
        return str(tool_input.get(arg_key, ""))
    # For unknown tools, try common keys
    for key in ("command", "file_path", "url", "query"):
        if key in tool_input:
            return str(tool_input[key])
    return ""


def find_matching_rule(
    rules: list[dict[str, str]], tool_name: str, primary_arg: str
) -> Optional[dict[str, str]]:
    """Return the first rule whose pattern matches this tool call."""
    for rule in rules:
        pattern = rule.get("pattern", "")
        if not pattern:
            continue
        rule_tool, glob = parse_pattern(pattern)
        if rule_tool != tool_name:
            continue
        if fnmatch.fnmatch(primary_arg, glob):
            return rule
        # Case-insensitive fallback for file paths
        if fnmatch.fnmatch(primary_arg.lower(), glob.lower()):
            return rule
    return None


def deny_response(reason: str) -> dict[str, Any]:
    """Build the JSON response that denies a tool call with a reason."""
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
        },
        "systemMessage": reason,
    }


def main() -> None:
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError:
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    cwd = Path(input_data.get("cwd", os.getcwd()))
    config = load_config(cwd)
    if not config:
        sys.exit(0)

    rules = config.get("rules", [])
    if not rules:
        sys.exit(0)

    primary_arg = get_primary_arg(tool_name, tool_input)
    matched = find_matching_rule(rules, tool_name, primary_arg)

    if matched:
        reason = matched.get(
            "reason", "This tool call was denied by project configuration."
        )
        print(json.dumps(deny_response(reason)))

    sys.exit(0)


if __name__ == "__main__":
    main()
