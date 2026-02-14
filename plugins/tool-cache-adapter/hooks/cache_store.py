#!/usr/bin/env python3
"""
cache_store.py — PostToolUse hook for caching tool results.

Runs after each tool execution. Stores the result in the cache
for future identical calls.

Hook flow:
  stdin  → {session_id, tool_name, tool_input, tool_result, ...}
  stdout → {} (JSON, no action needed)
  exit 0 → always succeeds (caching is best-effort)
"""

import json
import os
import sys

# Add plugin root to path for core imports
PLUGIN_ROOT = os.environ.get("CLAUDE_PLUGIN_ROOT", os.path.dirname(os.path.dirname(__file__)))
if PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

from core.cache_engine import CacheStore
from core.cache_policy import should_cache, get_policy


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        print(json.dumps({}))
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    tool_result = input_data.get("tool_result")
    session_id = input_data.get("session_id", "default")

    # Only cache if the tool call is cacheable
    if not should_cache(tool_name, tool_input):
        print(json.dumps({}))
        sys.exit(0)

    # Don't cache error results
    if _is_error_result(tool_result):
        print(json.dumps({}))
        sys.exit(0)

    # Don't cache empty results
    if tool_result is None or tool_result == "":
        print(json.dumps({}))
        sys.exit(0)

    # Don't cache very large results (> 100KB) — not worth the disk space
    result_str = json.dumps(tool_result) if not isinstance(tool_result, str) else tool_result
    if len(result_str) > 100_000:
        print(json.dumps({}))
        sys.exit(0)

    # Store in cache
    policy = get_policy(tool_name)
    store = CacheStore(session_id)

    store.put(
        tool_name=tool_name,
        tool_input=tool_input,
        result=tool_result,
        ttl_seconds=policy.ttl_seconds,
    )

    print(json.dumps({}))
    sys.exit(0)


def _is_error_result(result) -> bool:
    """Check if a tool result indicates an error."""
    if result is None:
        return True

    if isinstance(result, str):
        error_indicators = [
            "error:", "Error:", "ERROR:",
            "Traceback", "Exception",
            "command not found",
            "No such file or directory",
            "Permission denied",
        ]
        return any(ind in result for ind in error_indicators)

    if isinstance(result, dict):
        return result.get("is_error", False) or result.get("error") is not None

    return False


if __name__ == "__main__":
    main()
