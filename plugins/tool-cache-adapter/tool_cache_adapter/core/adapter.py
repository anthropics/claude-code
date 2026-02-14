"""Tool Cache Adapter - main orchestrator.

Wraps Claude Code agent tool invocations with a caching layer.
Called by PreToolUse and PostToolUse hooks to check/store cached results.

Cache flow:
  PreToolUse  --> adapter.check_cache(tool, input)
                  Hit?  -> deny tool + return cached result via systemMessage
                  Miss? -> allow tool (normal execution)

  PostToolUse --> adapter.store_result(tool, input, output)
                  Cacheable?  -> store in cache
                  Mutating?   -> invalidate affected caches
"""

from typing import Any, Dict, List, Optional, Tuple

from tool_cache_adapter.core.keys import generate_cache_key, file_path_key
from tool_cache_adapter.core.policy import get_policy, ToolCachePolicy
from tool_cache_adapter.core.store import FileCacheStore


class ToolCacheAdapter:
    """Adapter that intercepts tool calls and provides cached results."""

    def __init__(self, store: Optional[FileCacheStore] = None):
        self.store = store or FileCacheStore()

    # ── PreToolUse: cache lookup ──────────────────────────────

    def check_cache(self, tool_name: str, tool_input: Dict[str, Any]) -> Optional[str]:
        """Check if a cached result exists for this tool call.

        Args:
            tool_name: Name of the tool being invoked
            tool_input: Tool input parameters

        Returns:
            Cached result string if hit, None if miss or non-cacheable
        """
        policy = get_policy(tool_name)
        if not policy.cacheable:
            return None

        key = generate_cache_key(tool_name, tool_input)
        entry = self.store.get(key)
        if entry is not None:
            return entry.result
        return None

    # ── PostToolUse: cache store + invalidation ───────────────

    def store_result(self, tool_name: str, tool_input: Dict[str, Any],
                     tool_output: str) -> None:
        """Store a tool result in cache and handle invalidation.

        For cacheable tools: stores the result.
        For mutating tools: invalidates affected cache entries.

        Args:
            tool_name: Name of the tool that executed
            tool_input: Tool input parameters
            tool_output: Tool output/result string
        """
        policy = get_policy(tool_name)

        # Handle invalidation for mutating tools
        if policy.invalidates:
            self._invalidate(tool_name, tool_input, policy)

        # Store result for cacheable tools
        if policy.cacheable and tool_output:
            key = generate_cache_key(tool_name, tool_input)
            file_paths = self._extract_file_paths(tool_name, tool_input)
            self.store.put(
                key=key,
                tool_name=tool_name,
                tool_input=tool_input,
                result=tool_output,
                ttl=policy.ttl,
                file_paths=file_paths,
            )

    # ── Cache management ──────────────────────────────────────

    def clear(self) -> int:
        """Clear all cached entries."""
        return self.store.clear()

    def stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return self.store.stats()

    def evict_expired(self) -> int:
        """Remove expired entries."""
        return self.store.evict_expired()

    # ── Internal ──────────────────────────────────────────────

    def _invalidate(self, tool_name: str, tool_input: Dict[str, Any],
                    policy: ToolCachePolicy) -> None:
        """Invalidate cache entries affected by a mutating tool call."""
        file_path = self._get_mutated_file_path(tool_name, tool_input)

        if file_path:
            # Invalidate entries that reference this specific file
            self.store.invalidate_by_file(file_path)

        # Glob and Grep results are global — invalidate all of them
        # when any file mutation occurs
        self.store.invalidate_glob_grep()

    def _get_mutated_file_path(self, tool_name: str,
                                tool_input: Dict[str, Any]) -> Optional[str]:
        """Extract the file path being mutated by a write/edit tool."""
        if tool_name in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
            return tool_input.get("file_path") or tool_input.get("notebook_path")
        return None

    def _extract_file_paths(self, tool_name: str,
                            tool_input: Dict[str, Any]) -> List[str]:
        """Extract file paths from tool input for invalidation tracking."""
        paths = []
        if tool_name == "Read":
            fp = tool_input.get("file_path")
            if fp:
                paths.append(fp)
        elif tool_name == "Glob":
            path = tool_input.get("path")
            if path:
                paths.append(path)
        elif tool_name == "Grep":
            path = tool_input.get("path")
            if path:
                paths.append(path)
        return paths
