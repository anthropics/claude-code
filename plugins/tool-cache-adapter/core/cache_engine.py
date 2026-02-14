#!/usr/bin/env python3
"""
cache_engine.py — File-backed tool result cache with TTL.

Storage layout:
  ~/.claude/cache/
    ├── index.json        # {cache_key: {tool, ttl, mtime, size, hits}}
    └── entries/
        └── {sha256}.json # {key, tool_name, tool_input, result, created_at, ttl}

  /tmp/claude-cache-{session_id}/
    └── entries/           # Session-scoped fast cache (same format)
"""

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any, Optional


# ─── Cache Directories ──────────────────────────────────────────────────────

def _persistent_dir() -> Path:
    d = Path.home() / ".claude" / "cache"
    d.mkdir(parents=True, exist_ok=True)
    (d / "entries").mkdir(exist_ok=True)
    return d


def _session_dir(session_id: str) -> Path:
    d = Path(f"/tmp/claude-cache-{session_id}")
    d.mkdir(parents=True, exist_ok=True)
    (d / "entries").mkdir(exist_ok=True)
    return d


# ─── Key Generation ─────────────────────────────────────────────────────────

def generate_cache_key(tool_name: str, tool_input: dict) -> str:
    """Deterministic cache key from tool name + canonical JSON input."""
    canonical = json.dumps(tool_input, sort_keys=True, separators=(",", ":"))
    raw = f"{tool_name}:{canonical}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ─── Cache Entry ─────────────────────────────────────────────────────────────

class CacheEntry:
    __slots__ = ("key", "tool_name", "tool_input", "result", "created_at", "ttl_seconds")

    def __init__(self, key: str, tool_name: str, tool_input: dict,
                 result: Any, created_at: float, ttl_seconds: int):
        self.key = key
        self.tool_name = tool_name
        self.tool_input = tool_input
        self.result = result
        self.created_at = created_at
        self.ttl_seconds = ttl_seconds

    @property
    def is_expired(self) -> bool:
        if self.ttl_seconds <= 0:
            return False  # Never expires
        return (time.time() - self.created_at) > self.ttl_seconds

    @property
    def age_seconds(self) -> float:
        return time.time() - self.created_at

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "tool_name": self.tool_name,
            "tool_input": self.tool_input,
            "result": self.result,
            "created_at": self.created_at,
            "ttl_seconds": self.ttl_seconds,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "CacheEntry":
        return cls(
            key=d["key"],
            tool_name=d["tool_name"],
            tool_input=d["tool_input"],
            result=d["result"],
            created_at=d["created_at"],
            ttl_seconds=d["ttl_seconds"],
        )


# ─── Cache Store ─────────────────────────────────────────────────────────────

class CacheStore:
    """Two-tier cache: session-local (fast) + persistent (cross-session)."""

    def __init__(self, session_id: str = "default"):
        self.session_id = session_id
        self._session_dir = _session_dir(session_id)
        self._persistent_dir = _persistent_dir()
        self._stats = {"hits": 0, "misses": 0, "stores": 0, "evictions": 0}

    # ── Lookup ───────────────────────────────────────────────────────────

    def get(self, tool_name: str, tool_input: dict) -> Optional[CacheEntry]:
        """Look up cached result. Checks session cache first, then persistent."""
        key = generate_cache_key(tool_name, tool_input)

        # Session cache (fast path)
        entry = self._read_entry(self._session_dir, key)
        if entry and not entry.is_expired:
            self._stats["hits"] += 1
            return entry

        # Persistent cache
        entry = self._read_entry(self._persistent_dir, key)
        if entry and not entry.is_expired:
            self._stats["hits"] += 1
            # Promote to session cache
            self._write_entry(self._session_dir, entry)
            return entry

        # Expired entries get cleaned up
        if entry and entry.is_expired:
            self._delete_entry(self._persistent_dir, key)
            self._stats["evictions"] += 1

        self._stats["misses"] += 1
        return None

    # ── Store ────────────────────────────────────────────────────────────

    def put(self, tool_name: str, tool_input: dict, result: Any,
            ttl_seconds: int = 300) -> CacheEntry:
        """Store tool result in both session and persistent cache."""
        key = generate_cache_key(tool_name, tool_input)
        entry = CacheEntry(
            key=key,
            tool_name=tool_name,
            tool_input=tool_input,
            result=result,
            created_at=time.time(),
            ttl_seconds=ttl_seconds,
        )

        self._write_entry(self._session_dir, entry)
        self._write_entry(self._persistent_dir, entry)
        self._stats["stores"] += 1
        return entry

    # ── Invalidate ───────────────────────────────────────────────────────

    def invalidate(self, tool_name: str, tool_input: dict) -> bool:
        """Remove a specific cache entry."""
        key = generate_cache_key(tool_name, tool_input)
        s = self._delete_entry(self._session_dir, key)
        p = self._delete_entry(self._persistent_dir, key)
        return s or p

    def invalidate_tool(self, tool_name: str) -> int:
        """Invalidate all entries for a given tool. Returns count removed."""
        count = 0
        for cache_dir in [self._session_dir, self._persistent_dir]:
            entries_dir = cache_dir / "entries"
            if not entries_dir.exists():
                continue
            for f in entries_dir.glob("*.json"):
                try:
                    data = json.loads(f.read_text())
                    if data.get("tool_name") == tool_name:
                        f.unlink()
                        count += 1
                except (json.JSONDecodeError, KeyError):
                    pass
        return count

    def invalidate_all(self) -> int:
        """Clear entire cache. Returns count removed."""
        count = 0
        for cache_dir in [self._session_dir, self._persistent_dir]:
            entries_dir = cache_dir / "entries"
            if not entries_dir.exists():
                continue
            for f in entries_dir.glob("*.json"):
                f.unlink()
                count += 1
        return count

    # ── Stats ────────────────────────────────────────────────────────────

    @property
    def stats(self) -> dict:
        return {
            **self._stats,
            "hit_rate": (
                self._stats["hits"] / max(1, self._stats["hits"] + self._stats["misses"])
            ),
            "session_entries": self._count_entries(self._session_dir),
            "persistent_entries": self._count_entries(self._persistent_dir),
        }

    # ── Cleanup ──────────────────────────────────────────────────────────

    def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count removed."""
        count = 0
        for cache_dir in [self._session_dir, self._persistent_dir]:
            entries_dir = cache_dir / "entries"
            if not entries_dir.exists():
                continue
            for f in entries_dir.glob("*.json"):
                try:
                    data = json.loads(f.read_text())
                    entry = CacheEntry.from_dict(data)
                    if entry.is_expired:
                        f.unlink()
                        count += 1
                except (json.JSONDecodeError, KeyError):
                    f.unlink()
                    count += 1
        self._stats["evictions"] += count
        return count

    # ── Internal I/O ─────────────────────────────────────────────────────

    def _read_entry(self, cache_dir: Path, key: str) -> Optional[CacheEntry]:
        path = cache_dir / "entries" / f"{key}.json"
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            return CacheEntry.from_dict(data)
        except (json.JSONDecodeError, KeyError):
            path.unlink(missing_ok=True)
            return None

    def _write_entry(self, cache_dir: Path, entry: CacheEntry):
        path = cache_dir / "entries" / f"{entry.key}.json"
        path.write_text(json.dumps(entry.to_dict(), separators=(",", ":")))

    def _delete_entry(self, cache_dir: Path, key: str) -> bool:
        path = cache_dir / "entries" / f"{key}.json"
        if path.exists():
            path.unlink()
            return True
        return False

    def _count_entries(self, cache_dir: Path) -> int:
        entries_dir = cache_dir / "entries"
        if not entries_dir.exists():
            return 0
        return sum(1 for _ in entries_dir.glob("*.json"))
