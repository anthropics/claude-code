/**
 * Neon Serverless Postgres cache store for the tool cache adapter.
 *
 * Provides persistent, cross-session caching backed by the Neon branch
 * that corresponds to the current environment (preview or production).
 *
 * Uses the `@neondatabase/serverless` driver for HTTP-mode queries
 * (no persistent connection needed — ideal for serverless/edge).
 */

import type {
  CacheStore,
  CacheEntry,
  CacheStats,
  ToolName,
} from "./types";

/**
 * SQL schema expected in Neon:
 *
 * ```sql
 * CREATE TABLE IF NOT EXISTS tool_cache (
 *   key          TEXT PRIMARY KEY,
 *   tool         VARCHAR(100) NOT NULL,
 *   value        JSONB NOT NULL,
 *   stored_at    BIGINT NOT NULL,
 *   ttl_ms       BIGINT NOT NULL,
 *   hits         INTEGER NOT NULL DEFAULT 0,
 *   size_bytes   INTEGER NOT NULL DEFAULT 0,
 *   created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
 * );
 *
 * CREATE INDEX idx_tool_cache_tool ON tool_cache (tool);
 * CREATE INDEX idx_tool_cache_expires ON tool_cache ((stored_at + ttl_ms));
 * ```
 */

interface NeonCacheStoreOptions {
  /**
   * A query function that executes SQL against Neon.
   * Accepts a tagged template or (sql, params) signature.
   *
   * Compatible with:
   *   - `@neondatabase/serverless` neon() tagged template
   *   - `@vercel/postgres` sql tagged template
   *   - Any (query: string, params: unknown[]) => Promise<{ rows: any[] }>
   */
  sql: (query: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  /** Table name (default: 'tool_cache') */
  tableName?: string;
}

export class NeonCacheStore implements CacheStore {
  private sql: NeonCacheStoreOptions["sql"];
  private table: string;

  // In-process stats (reset on process restart)
  private hitCount = 0;
  private missCount = 0;

  constructor(options: NeonCacheStoreOptions) {
    this.sql = options.sql;
    this.table = options.tableName ?? "tool_cache";
  }

  /** Run the CREATE TABLE IF NOT EXISTS migration. */
  async migrate(): Promise<void> {
    await this.sql(
      `CREATE TABLE IF NOT EXISTS ${this.table} (
        key          TEXT PRIMARY KEY,
        tool         VARCHAR(100) NOT NULL,
        value        JSONB NOT NULL,
        stored_at    BIGINT NOT NULL,
        ttl_ms       BIGINT NOT NULL,
        hits         INTEGER NOT NULL DEFAULT 0,
        size_bytes   INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
      []
    );
    await this.sql(
      `CREATE INDEX IF NOT EXISTS idx_${this.table}_tool ON ${this.table} (tool)`,
      []
    );
    await this.sql(
      `CREATE INDEX IF NOT EXISTS idx_${this.table}_expires ON ${this.table} ((stored_at + ttl_ms))`,
      []
    );
  }

  async get(key: string): Promise<CacheEntry | null> {
    const now = Date.now();
    const { rows } = await this.sql(
      `SELECT value, tool, stored_at, ttl_ms, hits, size_bytes
       FROM ${this.table}
       WHERE key = $1 AND (stored_at + ttl_ms) > $2`,
      [key, now]
    );

    if (rows.length === 0) {
      this.missCount++;
      return null;
    }

    const row = rows[0];
    this.hitCount++;

    // Increment hit counter async (fire-and-forget)
    this.sql(
      `UPDATE ${this.table} SET hits = hits + 1 WHERE key = $1`,
      [key]
    ).catch(() => {});

    return {
      meta: {
        key,
        tool: row.tool as ToolName,
        storedAt: Number(row.stored_at),
        ttlMs: Number(row.ttl_ms),
        hits: Number(row.hits) + 1,
        sizeBytes: Number(row.size_bytes),
      },
      value: row.value,
    };
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    const valueJson = JSON.stringify(entry.value);
    await this.sql(
      `INSERT INTO ${this.table} (key, tool, value, stored_at, ttl_ms, hits, size_bytes)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         stored_at = EXCLUDED.stored_at,
         ttl_ms = EXCLUDED.ttl_ms,
         hits = 0,
         size_bytes = EXCLUDED.size_bytes`,
      [
        key,
        entry.meta.tool,
        valueJson,
        entry.meta.storedAt,
        entry.meta.ttlMs,
        entry.meta.hits,
        entry.meta.sizeBytes,
      ]
    );
  }

  async delete(key: string): Promise<boolean> {
    const { rows } = await this.sql(
      `DELETE FROM ${this.table} WHERE key = $1 RETURNING key`,
      [key]
    );
    return rows.length > 0;
  }

  async clear(tool?: ToolName): Promise<number> {
    if (!tool) {
      const { rows } = await this.sql(
        `WITH deleted AS (DELETE FROM ${this.table} RETURNING 1)
         SELECT count(*) as cnt FROM deleted`,
        []
      );
      return Number(rows[0]?.cnt ?? 0);
    }

    const { rows } = await this.sql(
      `WITH deleted AS (DELETE FROM ${this.table} WHERE tool = $1 RETURNING 1)
       SELECT count(*) as cnt FROM deleted`,
      [tool]
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  /** Remove all expired entries. Call periodically or via cron. */
  async purgeExpired(): Promise<number> {
    const now = Date.now();
    const { rows } = await this.sql(
      `WITH deleted AS (
         DELETE FROM ${this.table} WHERE (stored_at + ttl_ms) <= $1 RETURNING 1
       ) SELECT count(*) as cnt FROM deleted`,
      [now]
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  async stats(): Promise<CacheStats> {
    const { rows } = await this.sql(
      `SELECT
         count(*) as total_entries,
         COALESCE(sum(size_bytes), 0) as total_size_bytes,
         COALESCE(sum(hits), 0) as total_hits,
         tool,
         count(*) as tool_count
       FROM ${this.table}
       GROUP BY GROUPING SETS ((tool), ())`,
      []
    );

    const entriesByTool: Record<string, number> = {};
    let totalEntries = 0;
    let totalSizeBytes = 0;
    let totalHits = 0;

    for (const row of rows) {
      if (row.tool === null) {
        // Grand total row
        totalEntries = Number(row.total_entries);
        totalSizeBytes = Number(row.total_size_bytes);
        totalHits = Number(row.total_hits);
      } else {
        entriesByTool[row.tool as string] = Number(row.tool_count);
      }
    }

    return {
      totalEntries,
      totalSizeBytes,
      hitCount: this.hitCount,
      missCount: this.missCount,
      evictionCount: 0, // Neon doesn't evict — we purge expired
      entriesByTool,
    };
  }
}
