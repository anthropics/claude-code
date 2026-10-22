#!/usr/bin/env python3
"""Stop hook executor for hookify plugin.

Called by Claude Code when agent wants to stop.
Evaluates stop rules from .claude/hookify.*.local.md files.
"""

import sys
import json

try:
    from common import load_rules, RuleEngine, handle_error, safe_exit
except ImportError as e:
    print(json.dumps({"systemMessage": f"Hookify import error: {e}"}))
    sys.exit(0)


def main():
    """Evaluate Stop rules and return result."""
    try:
        input_data = json.load(sys.stdin)

        rules = load_rules(event='stop')
        engine = RuleEngine()
        result = engine.evaluate_rules(rules, input_data)

        print(json.dumps(result))

    except Exception as e:
        handle_error(e)

    finally:
        safe_exit()


if __name__ == '__main__':
    main()
