#!/usr/bin/env python3
"""PreToolUse hook executor for hookify plugin.

This script is called by Claude Code before any tool executes.
It reads .claude/hookify.*.local.md files and evaluates rules.
"""

import os
import sys
import json

# CRITICAL: Add plugin root to Python path for imports
# We need to add the parent of the plugin directory so Python can find "hookify" package
PLUGIN_ROOT = os.environ.get('CLAUDE_PLUGIN_ROOT')
if PLUGIN_ROOT:
    # Add the parent directory of the plugin
    parent_dir = os.path.dirname(PLUGIN_ROOT)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)

    # Also add PLUGIN_ROOT itself in case we have other scripts
    if PLUGIN_ROOT not in sys.path:
        sys.path.insert(0, PLUGIN_ROOT)

try:
    from hookify.core.config_loader import load_rules
    from hookify.core.rule_engine import RuleEngine
except ImportError as e:
    # If imports fail, allow operation and log error
    error_msg = {"systemMessage": f"Hookify import error: {e}"}
    print(json.dumps(error_msg), file=sys.stdout)
    sys.exit(0)


def main():
    """Main entry point for PreToolUse hook."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # Determine event type for filtering
        # For PreToolUse, we use tool_name to determine "bash" vs "file" event
        tool_name = input_data.get('tool_name', '')

        event = None
        if tool_name == 'Bash':
            event = 'bash'
        elif tool_name in ['Edit', 'Write', 'MultiEdit']:
            event = 'file'

        # Load rules
        rules = load_rules(event=event)

        # Evaluate rules
        engine = RuleEngine()
        result = engine.evaluate_rules(rules, input_data)

        # Always output JSON (even if empty)
        print(json.dumps(result), file=sys.stdout)

    except Exception as e:
        # On any error, allow the operation and log
        error_output = {
            "systemMessage": f"Hookify error: {str(e)}"
        }
        print(json.dumps(error_output), file=sys.stdout)

    finally:
        # ALWAYS exit 0 - never block operations due to hook errors
        sys.exit(0)


if __name__ == '__main__':
    main()
