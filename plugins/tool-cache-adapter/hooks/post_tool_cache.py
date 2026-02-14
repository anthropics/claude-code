#!/usr/bin/env python3
"""PostToolUse hook: store tool results in cache and handle invalidation.

For cacheable tools (Read, Glob, Grep, WebFetch, WebSearch):
    Store the result so future identical calls return from cache.

For mutating tools (Write, Edit, MultiEdit, NotebookEdit):
    Invalidate cached entries affected by the file change.

Input (stdin JSON):
    {
        "tool_name": "Read",
        "tool_input": {"file_path": "/foo/bar.py"},
        "tool_result": "...file contents..."
    }

Output: {} (always allow, no blocking)
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
    print(json.dumps({"systemMessage": f"tool-cache-adapter import error: {e}"}))
    sys.exit(0)


def main():
    try:
        input_data = json.load(sys.stdin)
        tool_name = input_data.get("tool_name", "")
        tool_input = input_data.get("tool_input", {})
        tool_result = input_data.get("tool_result", "")

        # Stringify result if it's not already a string
        if not isinstance(tool_result, str):
            tool_result = json.dumps(tool_result)

        adapter = ToolCacheAdapter()
        adapter.store_result(tool_name, tool_input, tool_result)

        # Periodically evict expired entries (every ~20 calls)
        import random
        if random.randint(1, 20) == 1:
            adapter.evict_expired()

        # Always allow — PostToolUse doesn't block
        print(json.dumps({}))

    except Exception as e:
        print(json.dumps({"systemMessage": f"tool-cache-adapter error: {e}"}))

    finally:
        sys.exit(0)


if __name__ == "__main__":
    main()
