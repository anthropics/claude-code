/**
 * In-memory LRU cache store for the tool cache adapter.
 *
 * Uses a Map (insertion-ordered) with eviction on capacity/size limits.
 * Suitable for single-process usage. For persistent/shared caching
 * see NeonCacheStore.
 */

import type {
  CacheStore,
  CacheEntry,
  CacheStats,
  ToolName,
} from "./types";

export class MemoryCacheStore implements CacheStore {
  private cache = new Map<string, CacheEntry>();
  private maxSizeBytes: number;
  private currentSizeBytes = 0;

  // Stats tracking
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;

  constructor(maxSizeBytes = 50 * 1024 * 1024) {
    this.maxSizeBytes = maxSizeBytes;
  }

  async get(key: string): Promise<CacheEntry | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check TTL expiration
    const age = Date.now() - entry.meta.storedAt;
    if (age > entry.meta.ttlMs) {
      this.cache.delete(key);
      this.currentSizeBytes -= entry.meta.sizeBytes;
      this.missCount++;
      return null;
    }

    // LRU: move to end (most recently used)
    this.cache.delete(key);
    entry.meta.hits++;
    this.cache.set(key, entry);
    this.hitCount++;

    return entry;
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    // Remove existing entry if present
    const existing = this.cache.get(key);
    if (existing) {
      this.cache.delete(key);
      this.currentSizeBytes -= existing.meta.sizeBytes;
    }

    // Evict oldest entries until we have room
    while (
      this.currentSizeBytes + entry.meta.sizeBytes > this.maxSizeBytes &&
      this.cache.size > 0
    ) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        const evicted = this.cache.get(oldest);
        this.cache.delete(oldest);
        if (evicted) {
          this.currentSizeBytes -= evicted.meta.sizeBytes;
        }
        this.evictionCount++;
      }
    }

    this.cache.set(key, entry);
    this.currentSizeBytes += entry.meta.sizeBytes;
  }

  async delete(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.currentSizeBytes -= entry.meta.sizeBytes;
    return true;
  }

  async clear(tool?: ToolName): Promise<number> {
    if (!tool) {
      const count = this.cache.size;
      this.cache.clear();
      this.currentSizeBytes = 0;
      return count;
    }

    let count = 0;
    for (const [key, entry] of this.cache) {
      if (entry.meta.tool === tool) {
        this.cache.delete(key);
        this.currentSizeBytes -= entry.meta.sizeBytes;
        count++;
      }
    }
    return count;
  }

  async stats(): Promise<CacheStats> {
    const entriesByTool: Record<string, number> = {};
    for (const entry of this.cache.values()) {
      entriesByTool[entry.meta.tool] =
        (entriesByTool[entry.meta.tool] || 0) + 1;
    }

    return {
      totalEntries: this.cache.size,
      totalSizeBytes: this.currentSizeBytes,
      hitCount: this.hitCount,
      missCount: this.missCount,
      evictionCount: this.evictionCount,
      entriesByTool,
    };
  }
}
