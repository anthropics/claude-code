#!/usr/bin/env python3
"""
cache_key.py — Tool-specific cache key generation.

Builds deterministic cache keys by:
1. Extracting only the fields that affect output (per CachePolicy.key_fields)
2. Adding file mtime for file-based tools (ensures cache invalidation on edit)
3. Normalizing values (sort arrays, strip whitespace, resolve paths)
"""

import hashlib
import json
import os
from typing import Optional

from .cache_policy import get_policy, get_file_mtime


def build_cache_key(tool_name: str, tool_input: dict) -> str:
    """Build a deterministic cache key for a tool invocation.

    The key is a SHA-256 hash of:
      tool_name + sorted(relevant_input_fields) + optional(file_mtime)
    """
    policy = get_policy(tool_name)

    # Extract only the fields that matter for cache identity
    if policy.key_fields:
        relevant = {}
        for field in policy.key_fields:
            if field in tool_input:
                relevant[field] = _normalize_value(field, tool_input[field])
    else:
        # No key_fields defined — use all input
        relevant = {k: _normalize_value(k, v) for k, v in tool_input.items()}

    # Add file mtime for file-aware caching
    if policy.use_mtime:
        mtime = get_file_mtime(tool_input)
        if mtime is not None:
            relevant["__mtime__"] = mtime

    # Build canonical key string
    canonical = json.dumps(relevant, sort_keys=True, separators=(",", ":"))
    raw = f"{tool_name}:{canonical}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _normalize_value(field: str, value):
    """Normalize a field value for consistent cache keys."""
    if value is None:
        return None

    # File paths: resolve to absolute, normalize
    if field in ("file_path", "path"):
        if isinstance(value, str):
            return os.path.normpath(os.path.abspath(value))

    # Arrays: sort for order-independent matching
    if isinstance(value, list):
        try:
            return sorted(value)
        except TypeError:
            return value

    # Strings: strip whitespace
    if isinstance(value, str):
        return value.strip()

    return value
