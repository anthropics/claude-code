/**
 * MemoryStore — persistent, indexed memory bank for agent knowledge.
 *
 * Stores memories as structured entries with metadata, relevance scoring,
 * and time-decay weighting. Backs to a JSON file for durability between
 * process restarts while staying dependency-free.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";

export class MemoryEntry {
  constructor({ key, content, tags = [], source = "agent", metadata = {} }) {
    this.id = crypto.randomUUID();
    this.key = key;
    this.content = content;
    this.tags = tags;
    this.source = source;
    this.metadata = metadata;
    this.createdAt = Date.now();
    this.lastAccessedAt = Date.now();
    this.accessCount = 0;
    this.importance = metadata.importance ?? 0.5;
  }

  touch() {
    this.lastAccessedAt = Date.now();
    this.accessCount += 1;
  }

  toJSON() {
    return {
      id: this.id,
      key: this.key,
      content: this.content,
      tags: this.tags,
      source: this.source,
      metadata: this.metadata,
      createdAt: this.createdAt,
      lastAccessedAt: this.lastAccessedAt,
      accessCount: this.accessCount,
      importance: this.importance,
    };
  }

  static fromJSON(obj) {
    const entry = new MemoryEntry({
      key: obj.key,
      content: obj.content,
      tags: obj.tags,
      source: obj.source,
      metadata: obj.metadata,
    });
    entry.id = obj.id;
    entry.createdAt = obj.createdAt;
    entry.lastAccessedAt = obj.lastAccessedAt;
    entry.accessCount = obj.accessCount;
    entry.importance = obj.importance;
    return entry;
  }
}

export class MemoryStore {
  constructor(storagePath = "data/memory-bank.json") {
    this.storagePath = storagePath;
    this.entries = new Map();
    this.tagIndex = new Map(); // tag -> Set<entryId>
    this.keyIndex = new Map(); // key -> entryId
    this._load();
  }

  /** Store a new memory or update an existing one by key. */
  store(key, content, { tags = [], source = "agent", metadata = {} } = {}) {
    if (this.keyIndex.has(key)) {
      return this.update(key, content, { tags, metadata });
    }

    const entry = new MemoryEntry({ key, content, tags, source, metadata });
    this.entries.set(entry.id, entry);
    this.keyIndex.set(key, entry.id);
    for (const tag of tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag).add(entry.id);
    }
    this._persist();
    return entry;
  }

  /** Update content/metadata of an existing memory by key. */
  update(key, content, { tags, metadata } = {}) {
    const id = this.keyIndex.get(key);
    if (!id) return null;
    const entry = this.entries.get(id);
    if (content !== undefined) entry.content = content;
    if (tags !== undefined) {
      // Remove old tag index entries
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(id);
      }
      entry.tags = tags;
      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
        this.tagIndex.get(tag).add(id);
      }
    }
    if (metadata !== undefined) {
      entry.metadata = { ...entry.metadata, ...metadata };
      if (metadata.importance !== undefined) entry.importance = metadata.importance;
    }
    entry.touch();
    this._persist();
    return entry;
  }

  /** Retrieve a memory by key. */
  recall(key) {
    const id = this.keyIndex.get(key);
    if (!id) return null;
    const entry = this.entries.get(id);
    entry.touch();
    this._persist();
    return entry;
  }

  /** Search memories by tags (OR match). Returns scored & sorted results. */
  search({ tags = [], query = "", limit = 10 } = {}) {
    let candidates = [];

    if (tags.length > 0) {
      const idSet = new Set();
      for (const tag of tags) {
        const ids = this.tagIndex.get(tag);
        if (ids) ids.forEach((id) => idSet.add(id));
      }
      candidates = [...idSet].map((id) => this.entries.get(id));
    } else {
      candidates = [...this.entries.values()];
    }

    if (query) {
      const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      candidates = candidates.filter((e) => {
        const text = `${e.key} ${e.content} ${e.tags.join(" ")}`.toLowerCase();
        return queryWords.some((word) => text.includes(word));
      });
    }

    // Score by: importance (40%) + recency (30%) + frequency (30%)
    const now = Date.now();
    const scored = candidates.map((entry) => {
      const ageHours = (now - entry.lastAccessedAt) / 3_600_000;
      const recencyScore = Math.max(0, 1 - ageHours / 720); // decays over 30 days
      const freqScore = Math.min(1, entry.accessCount / 20);
      const score =
        entry.importance * 0.4 + recencyScore * 0.3 + freqScore * 0.3;
      return { entry, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  /** Delete a memory by key. */
  forget(key) {
    const id = this.keyIndex.get(key);
    if (!id) return false;
    const entry = this.entries.get(id);
    for (const tag of entry.tags) {
      this.tagIndex.get(tag)?.delete(id);
    }
    this.entries.delete(id);
    this.keyIndex.delete(key);
    this._persist();
    return true;
  }

  /** Get all stored memory keys. */
  keys() {
    return [...this.keyIndex.keys()];
  }

  /** Total number of memories. */
  get size() {
    return this.entries.size;
  }

  /** Compact: remove lowest-scored memories when over a threshold. */
  compact(maxEntries = 500) {
    if (this.entries.size <= maxEntries) return 0;
    const scored = this.search({ limit: this.entries.size });
    const toRemove = scored.slice(maxEntries);
    for (const { entry } of toRemove) {
      this.forget(entry.key);
    }
    return toRemove.length;
  }

  // --- Persistence ---

  _persist() {
    const dir = dirname(this.storagePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const data = [...this.entries.values()].map((e) => e.toJSON());
    writeFileSync(this.storagePath, JSON.stringify(data, null, 2));
  }

  _load() {
    if (!existsSync(this.storagePath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.storagePath, "utf-8"));
      for (const obj of raw) {
        const entry = MemoryEntry.fromJSON(obj);
        this.entries.set(entry.id, entry);
        this.keyIndex.set(entry.key, entry.id);
        for (const tag of entry.tags) {
          if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
          this.tagIndex.get(tag).add(entry.id);
        }
      }
    } catch {
      // Corrupted file — start fresh
      this.entries.clear();
      this.tagIndex.clear();
      this.keyIndex.clear();
    }
  }
}
