#!/usr/bin/env python3
"""PostToolUse hook executor for hookify plugin.

Called by Claude Code after a tool executes.
Evaluates rules from .claude/hookify.*.local.md files.
"""

import sys
import json

try:
    from common import load_rules, RuleEngine, handle_error, safe_exit
except ImportError as e:
    print(json.dumps({"systemMessage": f"Hookify import error: {e}"}))
    sys.exit(0)


def main():
    """Evaluate PostToolUse rules and return result."""
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get('tool_name', '')

        # Map tool to event type
        event = None
        if tool_name == 'Bash':
            event = 'bash'
        elif tool_name in ['Edit', 'Write', 'MultiEdit']:
            event = 'file'

        rules = load_rules(event=event)
        engine = RuleEngine()
        result = engine.evaluate_rules(rules, input_data)

        print(json.dumps(result))

    except Exception as e:
        handle_error(e)

    finally:
        safe_exit()


if __name__ == '__main__':
    main()
