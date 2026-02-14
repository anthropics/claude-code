#!/usr/bin/env python3
"""
cache_lookup.py — PreToolUse hook for cache hit detection.

Runs before each tool execution. If a cached result exists for the
exact same tool+input, injects the cached result via systemMessage
so Claude can skip re-execution.

Hook flow:
  stdin  → {session_id, tool_name, tool_input, ...}
  stdout → {decision, systemMessage?} (JSON)
  exit 0 → allow tool execution (cache miss or non-cacheable)
"""

import json
import os
import sys
import time

# Add plugin root to path for core imports
PLUGIN_ROOT = os.environ.get("CLAUDE_PLUGIN_ROOT", os.path.dirname(os.path.dirname(__file__)))
if PLUGIN_ROOT not in sys.path:
    sys.path.insert(0, PLUGIN_ROOT)

from core.cache_engine import CacheStore
from core.cache_policy import should_cache, get_policy
from core.cache_key import build_cache_key


def main():
    try:
        input_data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        # Malformed input — allow tool to run normally
        print(json.dumps({}))
        sys.exit(0)

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})
    session_id = input_data.get("session_id", "default")

    # Check if this tool call is cacheable
    if not should_cache(tool_name, tool_input):
        # Not cacheable — check if this tool should invalidate other caches
        policy = get_policy(tool_name)
        if policy.invalidates:
            store = CacheStore(session_id)
            for target_tool in policy.invalidates:
                # Invalidate file-specific cache entries
                file_path = tool_input.get("file_path", "")
                if file_path:
                    # Invalidate Read cache for this specific file
                    store.invalidate(target_tool, {"file_path": file_path})
        print(json.dumps({}))
        sys.exit(0)

    # Look up cache
    store = CacheStore(session_id)
    entry = store.get(tool_name, tool_input)

    if entry is None:
        # Cache miss — allow tool to execute
        print(json.dumps({}))
        sys.exit(0)

    # Cache hit — inform Claude
    age = int(entry.age_seconds)
    result_preview = _truncate(str(entry.result), 500)

    message = (
        f"[CACHE HIT] Tool `{tool_name}` was called with identical parameters "
        f"{age}s ago. Cached result (TTL: {entry.ttl_seconds}s):\n\n"
        f"{result_preview}"
    )

    # Return cached result as system message
    # The tool still executes, but Claude sees the cached result
    # and can compare or skip re-processing
    output = {
        "systemMessage": message,
    }
    print(json.dumps(output))
    sys.exit(0)


def _truncate(s: str, max_len: int) -> str:
    if len(s) <= max_len:
        return s
    return s[:max_len] + f"... [{len(s) - max_len} more chars]"


if __name__ == "__main__":
    main()
