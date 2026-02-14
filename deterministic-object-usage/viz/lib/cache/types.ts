/**
 * Cache types for the Agent SDK tool cache adapter.
 *
 * Each built-in tool gets a typed cache entry with its input shape
 * (used as cache key) and output shape (stored as cached value).
 */

// ── Cache entry metadata ────────────────────────────────────────────────────

export interface CacheEntryMeta {
  /** SHA-256 hash of the canonical input */
  key: string;
  /** Tool that produced this entry */
  tool: ToolName;
  /** When the entry was stored */
  storedAt: number;
  /** TTL in ms from storedAt */
  ttlMs: number;
  /** Number of times this entry has been served from cache */
  hits: number;
  /** Size in bytes of the serialized value */
  sizeBytes: number;
}

export interface CacheEntry<T = unknown> {
  meta: CacheEntryMeta;
  value: T;
}

// ── Tool names (Agent SDK built-in + common MCP tools) ──────────────────────

export type BuiltInToolName =
  | "Bash"
  | "Read"
  | "Write"
  | "Edit"
  | "Glob"
  | "Grep"
  | "WebSearch"
  | "WebFetch"
  | "Task"
  | "AskUserQuestion"
  | "NotebookEdit";

export type ToolName = BuiltInToolName | `mcp__${string}__${string}`;

// ── Per-tool input shapes (used for cache key derivation) ───────────────────

export interface BashToolInput {
  command: string;
  timeout?: number;
  description?: string;
}

export interface ReadToolInput {
  file_path: string;
  offset?: number;
  limit?: number;
}

export interface WriteToolInput {
  file_path: string;
  content: string;
}

export interface EditToolInput {
  file_path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

export interface GlobToolInput {
  pattern: string;
  path?: string;
}

export interface GrepToolInput {
  pattern: string;
  path?: string;
  glob?: string;
  type?: string;
  output_mode?: "content" | "files_with_matches" | "count";
}

export interface WebSearchToolInput {
  query: string;
  allowed_domains?: string[];
  blocked_domains?: string[];
}

export interface WebFetchToolInput {
  url: string;
  prompt: string;
}

export interface TaskToolInput {
  prompt: string;
  description?: string;
  subagent_type?: string;
  model?: string;
  max_turns?: number;
}

export type ToolInput =
  | BashToolInput
  | ReadToolInput
  | WriteToolInput
  | EditToolInput
  | GlobToolInput
  | GrepToolInput
  | WebSearchToolInput
  | WebFetchToolInput
  | TaskToolInput
  | Record<string, unknown>;

// ── Cache strategy per tool ─────────────────────────────────────────────────

export type CacheStrategy = "always" | "idempotent" | "never";

export interface ToolCachePolicy {
  /** Caching strategy for this tool */
  strategy: CacheStrategy;
  /** Time-to-live in milliseconds */
  ttlMs: number;
  /** Maximum entries for this tool in the LRU */
  maxEntries: number;
  /** Fields to exclude from the cache key (e.g., 'description') */
  excludeFromKey?: string[];
  /**
   * Custom key derivation function. If provided, overrides default
   * JSON.stringify hashing. Useful for normalizing inputs.
   */
  keyFn?: (input: ToolInput) => string;
}

/**
 * Default cache policies for each built-in Agent SDK tool.
 *
 * Rationale:
 * - Read/Glob/Grep: Idempotent reads — cache aggressively but with file-aware TTL
 * - WebSearch: Results change frequently — short TTL
 * - WebFetch: Pages change — moderate TTL with URL-based key
 * - Bash: Side effects possible — never cache by default
 * - Write/Edit: Mutating — never cache
 * - Task: Subagent results vary — never cache by default
 * - AskUserQuestion: Interactive — never cache
 */
export const DEFAULT_TOOL_POLICIES: Record<BuiltInToolName, ToolCachePolicy> = {
  Read: {
    strategy: "idempotent",
    ttlMs: 5 * 60 * 1000,       // 5 min — file may change
    maxEntries: 200,
    excludeFromKey: [],
  },
  Glob: {
    strategy: "idempotent",
    ttlMs: 2 * 60 * 1000,       // 2 min — directory may change
    maxEntries: 100,
  },
  Grep: {
    strategy: "idempotent",
    ttlMs: 2 * 60 * 1000,       // 2 min — file contents may change
    maxEntries: 100,
  },
  WebSearch: {
    strategy: "idempotent",
    ttlMs: 15 * 60 * 1000,      // 15 min — search results shift
    maxEntries: 50,
    excludeFromKey: [],
  },
  WebFetch: {
    strategy: "idempotent",
    ttlMs: 15 * 60 * 1000,      // 15 min — page content changes
    maxEntries: 50,
    excludeFromKey: ["prompt"],   // Same URL = same fetch regardless of prompt
  },
  Bash: {
    strategy: "never",
    ttlMs: 0,
    maxEntries: 0,
  },
  Write: {
    strategy: "never",
    ttlMs: 0,
    maxEntries: 0,
  },
  Edit: {
    strategy: "never",
    ttlMs: 0,
    maxEntries: 0,
  },
  NotebookEdit: {
    strategy: "never",
    ttlMs: 0,
    maxEntries: 0,
  },
  Task: {
    strategy: "never",
    ttlMs: 0,
    maxEntries: 0,
  },
  AskUserQuestion: {
    strategy: "never",
    ttlMs: 0,
    maxEntries: 0,
  },
};

// ── Cache store interface (pluggable backends) ──────────────────────────────

export interface CacheStore {
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(tool?: ToolName): Promise<number>;
  stats(): Promise<CacheStats>;
}

export interface CacheStats {
  totalEntries: number;
  totalSizeBytes: number;
  hitCount: number;
  missCount: number;
  evictionCount: number;
  entriesByTool: Record<string, number>;
}

// ── Cache adapter options ───────────────────────────────────────────────────

export interface ToolCacheAdapterOptions {
  /** Override default policies per tool */
  policies?: Partial<Record<ToolName, Partial<ToolCachePolicy>>>;
  /** Pluggable backend (defaults to in-memory LRU) */
  store?: CacheStore;
  /** Global max cache size in bytes (default: 50MB) */
  maxSizeBytes?: number;
  /** Enable cache hit/miss logging */
  debug?: boolean;
  /**
   * Invalidation triggers: tool names whose execution should
   * invalidate cache entries for related tools.
   * e.g., { Write: ["Read", "Glob", "Grep"] } — writing a file
   * invalidates any cached reads of that path.
   */
  invalidationMap?: Record<string, ToolName[]>;
}
