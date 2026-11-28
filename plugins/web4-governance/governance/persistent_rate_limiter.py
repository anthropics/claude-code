# SPDX-License-Identifier: MIT
# Copyright (c) 2025 Web4 Contributors
#
# Web4 Lightweight Governance - Persistent Rate Limiter
# https://github.com/dp-web4/web4
"""
Persistent Rate Limiter - SQLite-backed sliding window counters.

Persists rate limit state across process restarts using SQLite WAL mode.
Falls back to memory-only operation if SQLite is unavailable.

Usage:
    from governance.persistent_rate_limiter import PersistentRateLimiter

    limiter = PersistentRateLimiter("~/.web4")

    # Check if under limit
    result = limiter.check("ratelimit:bash-rate:Bash", max_count=5, window_ms=60000)
    if result.allowed:
        # Proceed with action
        limiter.record("ratelimit:bash-rate:Bash")

    # Check if persistence is active
    if limiter.persistent:
        print("Using SQLite storage")
"""

import os
import time
import sqlite3
from dataclasses import dataclass
from typing import Dict, List, Optional
from pathlib import Path


@dataclass
class RateLimitResult:
    """Result of a rate limit check."""
    allowed: bool
    current: int
    limit: int


class PersistentRateLimiter:
    """
    Persistent rate limiter with SQLite storage.

    Maintains the same interface as the memory-only RateLimiter.
    Falls back to memory if SQLite initialization fails.
    """

    def __init__(self, storage_path: str):
        """
        Initialize the persistent rate limiter.

        Args:
            storage_path: Base path for storage (e.g., ~/.web4)
        """
        self._db: Optional[sqlite3.Connection] = None
        self._memory_fallback: Dict[str, List[float]] = {}
        self._is_persistent: bool = False
        self._init_database(storage_path)

    def _init_database(self, storage_path: str) -> None:
        """Initialize SQLite database with WAL mode."""
        try:
            # Expand path and create data directory
            base_path = Path(os.path.expanduser(storage_path))
            data_dir = base_path / "data"
            data_dir.mkdir(parents=True, exist_ok=True)

            db_path = data_dir / "rate-limits.db"
            self._db = sqlite3.connect(str(db_path), check_same_thread=False)

            # Enable WAL mode for better concurrent access
            self._db.execute("PRAGMA journal_mode = WAL")
            self._db.execute("PRAGMA synchronous = NORMAL")

            # Create rate limits table
            self._db.execute("""
                CREATE TABLE IF NOT EXISTS rate_limits (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL,
                    timestamp INTEGER NOT NULL
                )
            """)

            # Create index for efficient key lookups
            self._db.execute("""
                CREATE INDEX IF NOT EXISTS idx_rate_limits_key_ts
                ON rate_limits(key, timestamp)
            """)

            self._db.commit()
            self._is_persistent = True

        except Exception:
            # SQLite not available or failed, use memory fallback
            self._is_persistent = False

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
        now = int(time.time() * 1000)
        cutoff = now - window_ms

        if self._is_persistent and self._db:
            # Prune old entries for this key
            self._db.execute(
                "DELETE FROM rate_limits WHERE key = ? AND timestamp <= ?",
                (key, cutoff)
            )

            # Count remaining entries
            cursor = self._db.execute(
                "SELECT COUNT(*) FROM rate_limits WHERE key = ? AND timestamp > ?",
                (key, cutoff)
            )
            current = cursor.fetchone()[0]

            return RateLimitResult(
                allowed=current < max_count,
                current=current,
                limit=max_count
            )

        # Memory fallback
        timestamps = self._memory_fallback.get(key)
        if not timestamps:
            return RateLimitResult(allowed=True, current=0, limit=max_count)

        pruned = [t for t in timestamps if t > cutoff]
        self._memory_fallback[key] = pruned

        return RateLimitResult(
            allowed=len(pruned) < max_count,
            current=len(pruned),
            limit=max_count
        )

    def record(self, key: str) -> None:
        """
        Record a new action for the given key.

        Args:
            key: Rate limit key
        """
        now = int(time.time() * 1000)

        if self._is_persistent and self._db:
            self._db.execute(
                "INSERT INTO rate_limits (key, timestamp) VALUES (?, ?)",
                (key, now)
            )
            self._db.commit()
            return

        # Memory fallback
        if key in self._memory_fallback:
            self._memory_fallback[key].append(now)
        else:
            self._memory_fallback[key] = [now]

    def prune(self, window_ms: int) -> int:
        """
        Prune all expired entries across all keys.

        Args:
            window_ms: Window duration to use for pruning

        Returns:
            Number of entries pruned
        """
        now = int(time.time() * 1000)
        cutoff = now - window_ms

        if self._is_persistent and self._db:
            cursor = self._db.execute(
                "DELETE FROM rate_limits WHERE timestamp <= ?",
                (cutoff,)
            )
            self._db.commit()
            return cursor.rowcount

        # Memory fallback
        pruned = 0
        keys_to_remove = []

        for key, timestamps in self._memory_fallback.items():
            before = len(timestamps)
            filtered = [t for t in timestamps if t > cutoff]
            pruned += before - len(filtered)

            if not filtered:
                keys_to_remove.append(key)
            else:
                self._memory_fallback[key] = filtered

        for key in keys_to_remove:
            del self._memory_fallback[key]

        return pruned

    def count(self, key: str, window_ms: int = 3_600_000) -> int:
        """
        Get current count for a key within a window.

        Args:
            key: Rate limit key
            window_ms: Window duration (default 1 hour)

        Returns:
            Number of entries for key within window
        """
        cutoff = int(time.time() * 1000) - window_ms

        if self._is_persistent and self._db:
            cursor = self._db.execute(
                "SELECT COUNT(*) FROM rate_limits WHERE key = ? AND timestamp > ?",
                (key, cutoff)
            )
            return cursor.fetchone()[0]

        # Memory fallback
        timestamps = self._memory_fallback.get(key)
        if not timestamps:
            return 0
        return len([t for t in timestamps if t > cutoff])

    @property
    def key_count(self) -> int:
        """Number of tracked keys."""
        if self._is_persistent and self._db:
            cursor = self._db.execute("SELECT COUNT(DISTINCT key) FROM rate_limits")
            return cursor.fetchone()[0]
        return len(self._memory_fallback)

    @property
    def persistent(self) -> bool:
        """Whether persistence is active."""
        return self._is_persistent

    def close(self) -> None:
        """Close the database connection."""
        if self._db:
            self._db.close()
            self._db = None

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
