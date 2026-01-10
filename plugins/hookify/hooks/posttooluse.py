#!/usr/bin/env python3
"""PostToolUse hook executor for hookify plugin.

This script is called by Claude Code after a tool executes.
It reads .claude/hookify.*.local.md files and evaluates rules.
"""

import os
import sys
import json

# FAST PATH: Skip irrelevant tools immediately before any imports
# This avoids expensive module loading for tools we don't check
def get_tool_name_fast():
    """Read stdin to get tool_name."""
    try:
        data = json.load(sys.stdin)
        return data.get('tool_name', ''), data
    except:
        return '', {}

tool_name, input_data = get_tool_name_fast()

# Skip tools that don't need checking (read-only tools)
SKIP_TOOLS = {'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'TodoRead',
              'AskUser', 'TodoWrite', 'ListDir'}
if tool_name in SKIP_TOOLS or tool_name.startswith('mcp__'):
    sys.exit(0)

# Only now do expensive imports
# CRITICAL: Add plugin root to Python path for imports
PLUGIN_ROOT = os.environ.get('CLAUDE_PLUGIN_ROOT')
if PLUGIN_ROOT:
    parent_dir = os.path.dirname(PLUGIN_ROOT)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    if PLUGIN_ROOT not in sys.path:
        sys.path.insert(0, PLUGIN_ROOT)

try:
    from hookify.core.config_loader import load_rules
    from hookify.core.rule_engine import RuleEngine
except ImportError as e:
    error_msg = {"systemMessage": f"Hookify import error: {e}"}
    print(json.dumps(error_msg), file=sys.stdout)
    sys.exit(0)


def main():
    """Main entry point for PostToolUse hook."""
    global input_data, tool_name

    if not input_data:
        sys.exit(0)

    try:
        # Determine event type based on tool
        event = None
        if tool_name == 'Bash':
            event = 'bash'
        elif tool_name in ['Edit', 'Write', 'MultiEdit']:
            event = 'file'
        else:
            # Unknown tool type - skip
            sys.exit(0)

        # Load rules
        rules = load_rules(event=event)

        # Evaluate rules
        engine = RuleEngine()
        result = engine.evaluate_rules(rules, input_data)

        # Always output JSON (even if empty)
        print(json.dumps(result), file=sys.stdout)

    except Exception as e:
        error_output = {
            "systemMessage": f"Hookify error: {str(e)}"
        }
        print(json.dumps(error_output), file=sys.stdout)

    finally:
        # ALWAYS exit 0
        sys.exit(0)


if __name__ == '__main__':
    main()
