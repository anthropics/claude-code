"""Cache key generation for tool invocations.

Produces deterministic SHA-256 keys from tool name + sorted input parameters
so identical tool calls always resolve to the same cache entry.
"""

import hashlib
import json
from typing import Any, Dict


def generate_cache_key(tool_name: str, tool_input: Dict[str, Any]) -> str:
    """Generate a deterministic cache key from tool name and input.

    Args:
        tool_name: Name of the tool (Read, Glob, Grep, etc.)
        tool_input: Tool input parameters dict

    Returns:
        32-char hex string derived from SHA-256 hash
    """
    # Filter out parameters that shouldn't affect cache identity
    filtered_input = _normalize_input(tool_name, tool_input)
    normalized = json.dumps(
        {"tool": tool_name, "input": filtered_input},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:32]


def file_path_key(file_path: str) -> str:
    """Generate a key scoped to a specific file path (for invalidation lookups).

    Args:
        file_path: Absolute file path

    Returns:
        32-char hex string
    """
    return hashlib.sha256(file_path.encode("utf-8")).hexdigest()[:32]


def _normalize_input(tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize tool input for consistent hashing.

    Strips transient fields that don't affect the result (e.g., description).

    Args:
        tool_name: Tool name
        tool_input: Raw tool input

    Returns:
        Cleaned input dict
    """
    skip_fields = {"description", "run_in_background", "dangerouslyDisableSandbox"}
    return {k: v for k, v in tool_input.items() if k not in skip_fields}
