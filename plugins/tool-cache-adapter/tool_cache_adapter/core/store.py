"""File-based cache store.

Persists cached tool results as individual JSON files in a temp directory.
Each entry stores the result, creation timestamp, TTL, and metadata for
invalidation lookups.
"""

import json
import os
import time
import glob as globmod
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

CACHE_DIR = os.path.join(os.environ.get("TMPDIR", "/tmp"), "claude-tool-cache")


@dataclass
class CacheEntry:
    """A single cached tool result."""
    key: str
    tool_name: str
    tool_input: Dict[str, Any]
    result: str
    created_at: float
    ttl: int
    file_paths: List[str]  # file paths involved (for invalidation)

    def is_expired(self) -> bool:
        return (time.time() - self.created_at) > self.ttl

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CacheEntry":
        return cls(**data)


class FileCacheStore:
    """File-system backed cache store."""

    def __init__(self, cache_dir: str = CACHE_DIR):
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)

    # ── Read ──────────────────────────────────────────────────

    def get(self, key: str) -> Optional[CacheEntry]:
        """Retrieve a cache entry by key. Returns None on miss or expiry."""
        path = self._entry_path(key)
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r") as f:
                data = json.load(f)
            entry = CacheEntry.from_dict(data)
            if entry.is_expired():
                self._remove(path)
                return None
            return entry
        except (json.JSONDecodeError, TypeError, KeyError, OSError):
            self._remove(path)
            return None

    # ── Write ─────────────────────────────────────────────────

    def put(self, key: str, tool_name: str, tool_input: Dict[str, Any],
            result: str, ttl: int, file_paths: Optional[List[str]] = None) -> None:
        """Store a cache entry."""
        entry = CacheEntry(
            key=key,
            tool_name=tool_name,
            tool_input=tool_input,
            result=result,
            created_at=time.time(),
            ttl=ttl,
            file_paths=file_paths or [],
        )
        path = self._entry_path(key)
        try:
            with open(path, "w") as f:
                json.dump(entry.to_dict(), f)
        except OSError:
            pass  # silently skip on write failure

    # ── Invalidation ──────────────────────────────────────────

    def invalidate_by_file(self, file_path: str) -> int:
        """Remove all cache entries that reference a specific file path.

        Returns the number of entries invalidated.
        """
        count = 0
        for entry_file in globmod.glob(os.path.join(self.cache_dir, "*.json")):
            try:
                with open(entry_file, "r") as f:
                    data = json.load(f)
                if file_path in data.get("file_paths", []):
                    self._remove(entry_file)
                    count += 1
            except (json.JSONDecodeError, OSError):
                self._remove(entry_file)
        return count

    def invalidate_by_tool(self, tool_name: str) -> int:
        """Remove all cache entries for a specific tool.

        Returns the number of entries invalidated.
        """
        count = 0
        for entry_file in globmod.glob(os.path.join(self.cache_dir, "*.json")):
            try:
                with open(entry_file, "r") as f:
                    data = json.load(f)
                if data.get("tool_name") == tool_name:
                    self._remove(entry_file)
                    count += 1
            except (json.JSONDecodeError, OSError):
                self._remove(entry_file)
        return count

    def invalidate_glob_grep(self) -> int:
        """Invalidate all Glob and Grep entries (used when any file changes)."""
        count = 0
        count += self.invalidate_by_tool("Glob")
        count += self.invalidate_by_tool("Grep")
        return count

    # ── Maintenance ───────────────────────────────────────────

    def clear(self) -> int:
        """Remove all cache entries. Returns count of entries removed."""
        count = 0
        for entry_file in globmod.glob(os.path.join(self.cache_dir, "*.json")):
            self._remove(entry_file)
            count += 1
        return count

    def evict_expired(self) -> int:
        """Remove all expired entries. Returns count evicted."""
        count = 0
        for entry_file in globmod.glob(os.path.join(self.cache_dir, "*.json")):
            try:
                with open(entry_file, "r") as f:
                    data = json.load(f)
                entry = CacheEntry.from_dict(data)
                if entry.is_expired():
                    self._remove(entry_file)
                    count += 1
            except (json.JSONDecodeError, TypeError, KeyError, OSError):
                self._remove(entry_file)
                count += 1
        return count

    def stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        total = 0
        expired = 0
        by_tool: Dict[str, int] = {}
        total_size = 0

        for entry_file in globmod.glob(os.path.join(self.cache_dir, "*.json")):
            total += 1
            try:
                total_size += os.path.getsize(entry_file)
                with open(entry_file, "r") as f:
                    data = json.load(f)
                entry = CacheEntry.from_dict(data)
                tool = entry.tool_name
                by_tool[tool] = by_tool.get(tool, 0) + 1
                if entry.is_expired():
                    expired += 1
            except (json.JSONDecodeError, TypeError, KeyError, OSError):
                expired += 1

        return {
            "total_entries": total,
            "expired_entries": expired,
            "active_entries": total - expired,
            "by_tool": by_tool,
            "total_size_bytes": total_size,
            "cache_dir": self.cache_dir,
        }

    # ── Internal ──────────────────────────────────────────────

    def _entry_path(self, key: str) -> str:
        return os.path.join(self.cache_dir, f"{key}.json")

    def _remove(self, path: str) -> None:
        try:
            os.remove(path)
        except OSError:
            pass
