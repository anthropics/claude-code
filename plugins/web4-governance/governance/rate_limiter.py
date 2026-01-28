# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Rate Limiter
# https://github.com/dp-web4/web4
"""
Rate Limiter - Sliding window counters for policy rate limiting.

Memory-only (no persistence). Resets on session restart.
Keys are derived from rule context: e.g. "ratelimit:tool:Bash"

Usage:
    from governance.rate_limiter import RateLimiter

    limiter = RateLimiter()

    # Check if under limit
    result = limiter.check("ratelimit:bash-rate:Bash", max_count=5, window_ms=60000)
    if result.allowed:
        # Proceed with action
        pass

    # Record action after success
    limiter.record("ratelimit:bash-rate:Bash")
"""

import time
from dataclasses import dataclass
from typing import Dict, List


@dataclass
class RateLimitResult:
    """Result of a rate limit check."""
    allowed: bool
    current: int
    limit: int


class RateLimiter:
    """Sliding window rate limiter for policy enforcement."""

    def __init__(self):
        """Initialize with empty window map."""
        self._windows: Dict[str, List[float]] = {}

    def check(self, key: str, max_count: int, window_ms: int) -> RateLimitResult:
        """
        Check whether a key is under its rate limit. Prunes expired entries.

        Args:
            key: Rate limit key (e.g., "ratelimit:rule-id:tool:Bash")
            max_count: Maximum allowed actions within window
            window_ms: Window duration in milliseconds

        Returns:
            RateLimitResult with allowed flag, current count, and limit
        """
        now = time.time() * 1000  # Convert to milliseconds
        cutoff = now - window_ms
        timestamps = self._windows.get(key)

        if not timestamps:
            return RateLimitResult(allowed=True, current=0, limit=max_count)

        # Prune expired entries in-place
        pruned = [t for t in timestamps if t > cutoff]
        self._windows[key] = pruned

        return RateLimitResult(
            allowed=len(pruned) < max_count,
            current=len(pruned),
            limit=max_count,
        )

    def record(self, key: str) -> None:
        """
        Record a new action for the given key.

        Call this after a successful action to track the rate.

        Args:
            key: Rate limit key
        """
        now = time.time() * 1000
        if key in self._windows:
            self._windows[key].append(now)
        else:
            self._windows[key] = [now]

    def prune(self, window_ms: int) -> int:
        """
        Prune all expired entries across all keys.

        Args:
            window_ms: Window duration to use for pruning

        Returns:
            Number of entries pruned
        """
        now = time.time() * 1000
        cutoff = now - window_ms
        pruned = 0

        keys_to_remove = []
        for key, timestamps in self._windows.items():
            before = len(timestamps)
            filtered = [t for t in timestamps if t > cutoff]
            pruned += before - len(filtered)

            if not filtered:
                keys_to_remove.append(key)
            else:
                self._windows[key] = filtered

        for key in keys_to_remove:
            del self._windows[key]

        return pruned

    def count(self, key: str) -> int:
        """
        Get current count for a key (without pruning).

        Args:
            key: Rate limit key

        Returns:
            Number of timestamps recorded for key
        """
        return len(self._windows.get(key, []))

    @property
    def key_count(self) -> int:
        """Number of tracked keys."""
        return len(self._windows)

    @staticmethod
    def make_key(rule_id: str, tool_or_category: str) -> str:
        """
        Build a rate limit key from rule context.

        Args:
            rule_id: Policy rule ID
            tool_or_category: Tool name or category string

        Returns:
            Namespaced key string
        """
        return f"ratelimit:{rule_id}:{tool_or_category}"
