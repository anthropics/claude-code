#!/usr/bin/env python3
"""Stop hook executor for hookify plugin.

This script is called by Claude Code when agent wants to stop.
It reads .claude/hookify.*.local.md files and evaluates stop rules.
"""

import os
import sys
import json
from pathlib import Path

PLUGIN_ROOT = Path(
    os.environ.get('CLAUDE_PLUGIN_ROOT') or Path(__file__).resolve().parents[1]
).resolve()
if str(PLUGIN_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGIN_ROOT))

try:
    from core.config_loader import load_rules
    from core.rule_engine import RuleEngine
except ImportError as e:
    error_msg = {"systemMessage": f"Hookify import error: {e}"}
    print(json.dumps(error_msg), file=sys.stdout)
    sys.exit(0)


def main():
    """Main entry point for Stop hook."""
    try:
        # Read input from stdin
        input_data = json.load(sys.stdin)

        # A blocked Stop causes Claude Code to invoke Stop hooks again. Do not
        # re-apply the same rule during that continuation.
        if input_data.get('stop_hook_active') is True:
            print(json.dumps({}), file=sys.stdout)
            return

        # Load stop rules
        rules = load_rules(event='stop', root_dir=input_data.get('cwd'))

        # Evaluate rules
        engine = RuleEngine()
        result = engine.evaluate_rules(rules, input_data)

        # Always output JSON (even if empty)
        print(json.dumps(result), file=sys.stdout)

    except Exception as e:
        # On any error, allow the operation
        error_output = {
            "systemMessage": f"Hookify error: {str(e)}"
        }
        print(json.dumps(error_output), file=sys.stdout)

    finally:
        # ALWAYS exit 0
        sys.exit(0)


if __name__ == '__main__':
    main()
