#!/usr/bin/env python3
"""PreToolUse hook: check cache before tool execution.

On cache hit:  deny the tool call and feed the cached result back to Claude
               via systemMessage so it can use the data without re-executing.
On cache miss: allow normal tool execution (exit 0 with empty JSON).

Input (stdin JSON):
    {"tool_name": "Read", "tool_input": {"file_path": "/foo/bar.py"}}

Output (stdout JSON):
    Hit:  {"hookSpecificOutput": {"permissionDecision": "deny"},
           "systemMessage": "[CACHE HIT] ...cached result..."}
    Miss: {}
"""

import json
import os
import sys

# Add plugin root to Python path
PLUGIN_ROOT = os.environ.get("CLAUDE_PLUGIN_ROOT")
if PLUGIN_ROOT:
    parent_dir = os.path.dirname(PLUGIN_ROOT)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)
    if PLUGIN_ROOT not in sys.path:
        sys.path.insert(0, PLUGIN_ROOT)

try:
    from tool_cache_adapter.core.adapter import ToolCacheAdapter
except ImportError as e:
    # If imports fail, allow the tool to run normally
    print(json.dumps({"systemMessage": f"tool-cache-adapter import error: {e}"}))
    sys.exit(0)


def main():
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})

        adapter = ToolCacheAdapter()
        cached = adapter.check_cache(tool_name, tool_input)

        if cached is not None:
            # Cache hit — deny tool execution and return cached result
            result = {
                "hookSpecificOutput": {
                    "permissionDecision": "deny",
                },
                "systemMessage": (
                    f"[CACHE HIT for {tool_name}] "
                    f"Returning cached result (tool execution skipped):\n\n"
                    f"{cached}"
                ),
            }
            print(json.dumps(result))
        else:
            # Cache miss — allow normal execution
            print(json.dumps({}))

    except Exception as e:
        # On error, allow the tool to run
        print(json.dumps({"systemMessage": f"tool-cache-adapter error: {e}"}))

    finally:
        sys.exit(0)


if __name__ == "__main__":
    main()
