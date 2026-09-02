#!/usr/bin/env python3
"""
Agent Instructions Loader - SubagentStart Hook
===============================================
Loads custom agent body content (markdown after YAML frontmatter) as
additional context when subagents are spawned via the Task tool.

How it works:
1. When a subagent is spawned, this hook receives the agent_type
2. It searches for the agent definition file in standard locations
3. If found, it extracts the body content (after frontmatter)
4. The body is returned as additionalContext for the subagent

Standard agent file locations searched:
- .claude/agents/<agent_type>.md
- plugins/*/agents/<agent_type>.md
- User settings plugins

Author: Claude Code Contributors
License: MIT
"""

import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

# Enable debug logging with AGENT_INSTRUCTIONS_LOADER_DEBUG=true
DEBUG = os.environ.get("AGENT_INSTRUCTIONS_LOADER_DEBUG", "").lower() == "true"


def debug_log(msg: str) -> None:
    """Log debug messages to stderr when DEBUG is enabled."""
    if DEBUG:
        print(f"[agent-instructions-loader] {msg}", file=sys.stderr)


def is_valid_agent_type(agent_type: str) -> bool:
    """
    Validate agent_type to prevent path traversal attacks.

    Agent types must be valid identifiers: alphanumeric, underscores, and hyphens only.
    No path separators, dots (except in valid positions), or special characters.

    Security: This prevents attacks like:
    - "../../evil" (path traversal)
    - "foo/bar" (subdirectory injection)
    - "foo\\bar" (Windows path injection)
    """
    # Reject empty strings
    if not agent_type:
        return False

    # Reject path traversal patterns
    if '..' in agent_type:
        debug_log(f"Rejected agent_type with path traversal: {agent_type}")
        return False

    # Reject path separators
    if '/' in agent_type or '\\' in agent_type:
        debug_log(f"Rejected agent_type with path separator: {agent_type}")
        return False

    # Only allow valid identifier characters: alphanumeric, underscore, hyphen
    # Also allow single dots for namespaced agents like "plugin:agent-name"
    if not re.match(r'^[a-zA-Z0-9_:-]+$', agent_type):
        debug_log(f"Rejected agent_type with invalid characters: {agent_type}")
        return False

    return True


def find_agent_file(agent_type: str, cwd: str) -> Optional[Path]:
    """
    Search for an agent definition file by agent type.

    Searches in these locations:
    1. .claude/agents/<agent_type>.md (project agents)
    2. plugins/*/agents/<agent_type>.md (plugin agents in project)
    3. ~/.claude/plugins/*/agents/<agent_type>.md (user plugin agents)
    """
    search_paths = []

    # Project agents directory
    project_agents = Path(cwd) / ".claude" / "agents"
    if project_agents.exists():
        search_paths.append(project_agents / f"{agent_type}.md")

    # Project plugins
    project_plugins = Path(cwd) / "plugins"
    if project_plugins.exists():
        for plugin_dir in project_plugins.iterdir():
            if plugin_dir.is_dir():
                agents_dir = plugin_dir / "agents"
                if agents_dir.exists():
                    search_paths.append(agents_dir / f"{agent_type}.md")

    # User plugins directory
    home = Path.home()
    user_plugins = home / ".claude" / "plugins"
    if user_plugins.exists():
        # Check direct plugins
        for plugin_dir in user_plugins.iterdir():
            if plugin_dir.is_dir():
                agents_dir = plugin_dir / "agents"
                if agents_dir.exists():
                    search_paths.append(agents_dir / f"{agent_type}.md")

        # Check cached marketplace plugins
        cache_dir = user_plugins / "cache"
        if cache_dir.exists():
            for marketplace_dir in cache_dir.iterdir():
                if marketplace_dir.is_dir():
                    for plugin_dir in marketplace_dir.iterdir():
                        if plugin_dir.is_dir():
                            # Handle version directories
                            for version_dir in plugin_dir.iterdir():
                                if version_dir.is_dir():
                                    agents_dir = version_dir / "agents"
                                    if agents_dir.exists():
                                        search_paths.append(agents_dir / f"{agent_type}.md")

    # Also check CLAUDE_PLUGIN_ROOT if available (for plugin-local agents)
    plugin_root = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if plugin_root:
        plugin_agents = Path(plugin_root) / "agents"
        if plugin_agents.exists():
            search_paths.append(plugin_agents / f"{agent_type}.md")

    # Search all paths
    for path in search_paths:
        if path.exists() and path.is_file():
            return path

    return None


def extract_body_from_markdown(content: str) -> str:
    """
    Extract the body content from an agent markdown file.

    Agent files have YAML frontmatter between --- delimiters,
    followed by the body content which should become the system prompt.

    Example:
    ---
    name: my-agent
    description: "My agent description"
    ---

    # Body Content
    This is the system prompt content.
    """
    # Match YAML frontmatter: starts with ---, ends with ---
    frontmatter_pattern = r"^---\s*\n.*?\n---\s*\n?"

    match = re.match(frontmatter_pattern, content, re.DOTALL)
    if match:
        # Return everything after the frontmatter
        body = content[match.end():].strip()
        return body

    # No frontmatter found, return the whole content
    return content.strip()


def main():
    try:
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        # Invalid JSON input - non-blocking error
        print(f"Error: Invalid JSON input: {e}", file=sys.stderr)
        sys.exit(1)

    hook_event = input_data.get("hook_event_name", "")
    if hook_event != "SubagentStart":
        # Not a SubagentStart event, exit silently
        sys.exit(0)

    agent_type = input_data.get("agent_type", "")
    if not agent_type:
        # No agent type specified, nothing to inject
        debug_log("No agent_type specified, skipping")
        sys.exit(0)

    # Security: Validate agent_type to prevent path traversal attacks
    if not is_valid_agent_type(agent_type):
        debug_log(f"Invalid agent_type rejected: {agent_type}")
        sys.exit(0)

    # NOTE: Update this set when new built-in agents are added to Claude Code
    # Built-in agents don't have custom body content to inject
    # Last updated: 2026-01 (Claude Code v2.1.x)
    builtin_agents = {
        "Bash",
        "Explore",
        "Plan",
        "general-purpose",
        "code-reviewer",
        "test-runner",
        "statusline-setup",
    }

    if agent_type in builtin_agents:
        # Built-in agent, no custom instructions to inject
        debug_log(f"Skipping built-in agent: {agent_type}")
        sys.exit(0)

    # Validate cwd - must be an absolute path
    cwd = input_data.get("cwd", "")
    if not cwd or not os.path.isabs(cwd):
        cwd = os.getcwd()
        debug_log(f"Using fallback cwd: {cwd}")

    debug_log(f"Looking for agent '{agent_type}' in cwd: {cwd}")

    # Find the agent definition file
    agent_file = find_agent_file(agent_type, cwd)

    if not agent_file:
        # Agent file not found - this is OK, might be a JSON-defined agent
        # or a built-in agent we didn't recognize
        debug_log(f"Agent file not found for: {agent_type}")
        sys.exit(0)

    debug_log(f"Found agent file: {agent_file}")

    try:
        content = agent_file.read_text(encoding="utf-8")
    except Exception as e:
        print(f"Warning: Could not read agent file {agent_file}: {e}", file=sys.stderr)
        sys.exit(0)

    # Extract the body content
    body = extract_body_from_markdown(content)

    if not body:
        # No body content to inject
        debug_log(f"No body content found in: {agent_file}")
        sys.exit(0)

    debug_log(f"Extracted body content ({len(body)} chars)")

    # Format the injection context
    additional_context = f"""# Custom Agent Instructions

The following instructions define your specialized behavior as the "{agent_type}" agent.
You MUST follow these instructions precisely.

---
{body}
---

IMPORTANT: The instructions above are your primary directives. Follow them exactly."""

    # Output the additional context for injection
    output = {
        "hookSpecificOutput": {
            "hookEventName": "SubagentStart",
            "additionalContext": additional_context
        }
    }

    debug_log(f"Injecting {len(additional_context)} chars of context for agent: {agent_type}")
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
