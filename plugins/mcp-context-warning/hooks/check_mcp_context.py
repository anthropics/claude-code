#!/usr/bin/env python3
"""
MCP Context Warning Hook for Claude Code

This hook runs at session start and warns users when their MCP servers
are consuming significant context (>20k tokens). This helps users understand
why they might be burning through context quickly.
"""

import json
import os
import sys
from pathlib import Path

# Threshold in tokens for showing a warning
TOKEN_WARNING_THRESHOLD = 20000

# Estimated tokens per MCP tool (based on real-world data:
# Asana: ~836/tool, Gmail: ~833/tool, Google Calendar: ~1867/tool, Google Drive: ~1260/tool)
# Using 1000 as a conservative average
TOKENS_PER_TOOL_ESTIMATE = 1000

# Base overhead per MCP server (connection info, auth, etc.)
BASE_TOKENS_PER_SERVER = 500


def find_mcp_configs(cwd: str) -> list[tuple[str, dict]]:
    """
    Find all MCP configuration files that might be loaded.

    Returns list of (path, config) tuples.
    """
    configs = []

    # Check project-level .mcp.json
    project_mcp = Path(cwd) / ".mcp.json"
    if project_mcp.exists():
        try:
            with open(project_mcp) as f:
                configs.append((str(project_mcp), json.load(f)))
        except (json.JSONDecodeError, IOError):
            pass

    # Check user-level MCP config (~/.claude/.mcp.json)
    user_mcp = Path.home() / ".claude" / ".mcp.json"
    if user_mcp.exists():
        try:
            with open(user_mcp) as f:
                configs.append((str(user_mcp), json.load(f)))
        except (json.JSONDecodeError, IOError):
            pass

    return configs


def count_servers_and_estimate_tools(configs: list[tuple[str, dict]]) -> tuple[dict, int]:
    """
    Count MCP servers and estimate their tool counts.

    Returns (server_info dict, total_estimated_tokens).
    """
    server_info = {}

    for path, config in configs:
        # MCP config format: {"mcpServers": {"server-name": {...}}}
        mcp_servers = config.get("mcpServers", {})

        for server_name, server_config in mcp_servers.items():
            if server_name in server_info:
                continue  # Skip duplicates

            # Try to get tool count from config if available
            # Otherwise use a default estimate
            tool_count = server_config.get("toolCount", 10)  # Default 10 tools

            server_info[server_name] = {
                "source": path,
                "estimated_tools": tool_count,
            }

    # Calculate total estimated tokens
    total_tokens = 0
    for server_name, info in server_info.items():
        server_tokens = BASE_TOKENS_PER_SERVER + (info["estimated_tools"] * TOKENS_PER_TOOL_ESTIMATE)
        info["estimated_tokens"] = server_tokens
        total_tokens += server_tokens

    return server_info, total_tokens


def format_warning_message(server_info: dict, total_tokens: int) -> str:
    """Format a warning message about MCP context usage."""

    # Build server breakdown table
    lines = [
        f"Your MCP servers are using an estimated ~{total_tokens:,} tokens of context.",
        "",
        "Server breakdown:",
    ]

    # Sort servers by token usage (highest first)
    sorted_servers = sorted(
        server_info.items(),
        key=lambda x: x[1]["estimated_tokens"],
        reverse=True
    )

    for server_name, info in sorted_servers:
        tokens = info["estimated_tokens"]
        tools = info["estimated_tools"]
        lines.append(f"  - {server_name}: ~{tokens:,} tokens ({tools} tools)")

    lines.extend([
        "",
        "Consider disabling MCP servers you're not actively using to conserve context.",
        "You can manage MCP servers with `/mcp disable <server-name>` or by editing .mcp.json.",
    ])

    return "\n".join(lines)


def main():
    """Main hook function."""
    # Read input from stdin
    try:
        raw_input = sys.stdin.read()
        input_data = json.loads(raw_input) if raw_input.strip() else {}
    except json.JSONDecodeError:
        # If we can't parse input, exit silently
        sys.exit(0)

    # Get current working directory from hook input or environment
    cwd = input_data.get("cwd", os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))

    # Find MCP configurations
    configs = find_mcp_configs(cwd)

    if not configs:
        # No MCP configs found, nothing to warn about
        sys.exit(0)

    # Count servers and estimate tokens
    server_info, total_tokens = count_servers_and_estimate_tools(configs)

    if not server_info:
        # No servers configured
        sys.exit(0)

    # Check if we're over the warning threshold
    if total_tokens >= TOKEN_WARNING_THRESHOLD:
        warning_message = format_warning_message(server_info, total_tokens)

        # Output JSON with systemMessage for Claude to see
        output = {
            "continue": True,
            "systemMessage": warning_message
        }
        print(json.dumps(output))

    sys.exit(0)


if __name__ == "__main__":
    main()
