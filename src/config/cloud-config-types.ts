/**
 * Type definitions for the cloud-synced CLAUDE.md configuration system.
 *
 * These types model the lifecycle of cloud config data from API response
 * through local cache to resolved system prompt content. Discriminated
 * unions are used for cache status and sync state to ensure exhaustive
 * handling at every decision point.
 */

// ---------------------------------------------------------------------------
// Branded types
// ---------------------------------------------------------------------------

/**
 * Opaque brand for content version identifiers returned by the API.
 * Prevents accidental assignment of arbitrary numbers where a version
 * is expected (e.g., passing a timestamp where a version counter belongs).
 */
declare const VersionBrand: unique symbol;
export type ContentVersion = number & { readonly [VersionBrand]: typeof VersionBrand };

/**
 * Opaque brand for ETag strings. ETags are server-opaque and must never be
 * constructed by client code -- only stored as received from HTTP headers.
 */
declare const ETagBrand: unique symbol;
export type ETag = string & { readonly [ETagBrand]: typeof ETagBrand };

/**
 * Opaque brand for SHA-256 content hashes (hex-encoded, 64 chars).
 * Distinguishes from arbitrary strings to prevent comparison errors.
 */
declare const ContentHashBrand: unique symbol;
export type ContentHash = string & { readonly [ContentHashBrand]: typeof ContentHashBrand };

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

/** Successful response from GET /v1/user/instructions */
export interface InstructionsResponse {
  readonly content: string;
  readonly version: ContentVersion;
  readonly contentHash: ContentHash;
  readonly etag: ETag;
  readonly updatedAt: string; // ISO-8601
  readonly updatedBy: string; // e.g. "cli/1.5.0", "web"
}

/** Response from GET /v1/user/instructions/metadata (hot path) */
export interface MetadataResponse {
  readonly version: ContentVersion;
  readonly contentHash: ContentHash;
  readonly etag: ETag;
  readonly updatedAt: string;
  readonly updatedBy: string;
  readonly contentLength: number;
}

// ---------------------------------------------------------------------------
// History types
// ---------------------------------------------------------------------------

/** A single entry in the version history listing */
export interface HistoryEntry {
  readonly version: ContentVersion;
  readonly updatedAt: string;
  readonly updatedBy: string;
  readonly contentLength: number;
  readonly contentHash: ContentHash;
}

/** Paginated result from GET /v1/user/instructions/history */
export interface HistoryPage {
  readonly versions: ReadonlyArray<HistoryEntry>;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Cache types
// ---------------------------------------------------------------------------

/** Shape of the JSON file persisted at ~/.claude/cache/cloud-config.json */
export interface CacheFile {
  readonly content: string;
  readonly version: ContentVersion;
  readonly contentHash: ContentHash;
  readonly etag: ETag;
  readonly fetchedAt: number; // Date.now() epoch ms
  readonly updatedAt: string; // ISO-8601 from server
  readonly updatedBy: string;
}

/** Validated in-memory representation after reading and checking the cache file */
export interface CloudConfigCache {
  readonly data: CacheFile;
  readonly isExpired: boolean;
  readonly ageMs: number;
}

// ---------------------------------------------------------------------------
// Cache status (discriminated union)
// ---------------------------------------------------------------------------

export type CacheStatus =
  | CacheHit
  | CacheStale
  | CacheMiss
  | CacheCorrupt;

interface CacheHit {
  readonly kind: "hit";
  readonly cache: CloudConfigCache;
}

interface CacheStale {
  readonly kind: "stale";
  readonly cache: CloudConfigCache;
}

interface CacheMiss {
  readonly kind: "miss";
  readonly reason: "no-file" | "invalid-schema";
}

interface CacheCorrupt {
  readonly kind: "corrupt";
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Fetch result (discriminated union)
// ---------------------------------------------------------------------------

export type FetchResult =
  | FetchSuccess
  | FetchNotModified
  | FetchNotFound
  | FetchConflict
  | FetchRateLimited
  | FetchAuthError
  | FetchServerError
  | FetchTimeout
  | FetchNetworkError;

interface FetchSuccess {
  readonly kind: "success";
  readonly data: InstructionsResponse;
}

interface FetchNotModified {
  readonly kind: "not-modified";
}

interface FetchNotFound {
  readonly kind: "not-found";
}

interface FetchConflict {
  readonly kind: "conflict";
  readonly serverVersion: ContentVersion;
}

interface FetchRateLimited {
  readonly kind: "rate-limited";
  readonly retryAfterSeconds: number | null;
}

interface FetchAuthError {
  readonly kind: "auth-error";
  readonly status: 401 | 403;
}

interface FetchServerError {
  readonly kind: "server-error";
  readonly status: number;
  readonly message: string;
}

interface FetchTimeout {
  readonly kind: "timeout";
}

interface FetchNetworkError {
  readonly kind: "network-error";
  readonly error: unknown;
}

// ---------------------------------------------------------------------------
// Sync state
// ---------------------------------------------------------------------------

/**
 * Persisted at ~/.claude/sync-state.json to survive across sessions.
 * Tracks the last successfully synced version and any pending operations.
 */
export interface SyncState {
  readonly enabled: boolean;
  readonly lastSyncedVersion: ContentVersion | null;
  readonly lastSyncedAt: number | null; // epoch ms
  readonly lastSyncedEtag: ETag | null;
  readonly lastSyncedContentHash: ContentHash | null;
  readonly pendingPush: boolean;
  readonly pendingPushSince: number | null; // epoch ms
  /**
   * Set when cloud content changed out-of-band and needs explicit
   * user review before being injected into runtime prompts.
   */
  readonly pendingReviewHash?: ContentHash | null;
  readonly pendingReviewVersion?: ContentVersion | null;
  readonly pendingReviewSince?: number | null; // epoch ms
}

export const DEFAULT_SYNC_STATE: SyncState = {
  enabled: false,
  lastSyncedVersion: null,
  lastSyncedAt: null,
  lastSyncedEtag: null,
  lastSyncedContentHash: null,
  pendingPush: false,
  pendingPushSince: null,
  pendingReviewHash: null,
  pendingReviewVersion: null,
  pendingReviewSince: null,
};

// ---------------------------------------------------------------------------
// Resolved config (what the provider returns to consumers)
// ---------------------------------------------------------------------------

export type ResolvedCloudConfig =
  | ResolvedFromCache
  | ResolvedFromFetch
  | ResolvedSkipped
  | ResolvedUnavailable;

interface ResolvedFromCache {
  readonly kind: "cached";
  readonly content: string;
  readonly version: ContentVersion;
  readonly stale: boolean;
  /** True when a background refresh was initiated */
  readonly refreshing: boolean;
}

interface ResolvedFromFetch {
  readonly kind: "fetched";
  readonly content: string;
  readonly version: ContentVersion;
}

interface ResolvedSkipped {
  readonly kind: "skipped";
  readonly reason:
    | "no-auth"
    | "simple-mode"
    | "disabled"
    | "no-cloud-env"
    | "sync-disabled"
    | "missing-scope";
}

interface ResolvedUnavailable {
  readonly kind: "unavailable";
  readonly reason:
    | "timeout"
    | "network-error"
    | "server-error"
    | "auth-error"
    | "not-found"
    | "rate-limited"
    | "review-required";
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface CloudConfigOptions {
  /** Cache TTL in milliseconds. Default: 5 minutes (300_000). */
  readonly cacheTtlMs: number;

  /** Timeout for blocking first-run fetch in milliseconds. Default: 2_000. */
  readonly firstRunTimeoutMs: number;

  /** Timeout for background refresh fetch in milliseconds. Default: 3_000. */
  readonly backgroundTimeoutMs: number;

  /** Base URL for the Anthropic API. Default: "https://api.anthropic.com". */
  readonly apiBaseUrl: string;

  /**
   * Override for the config directory (normally ~/.claude).
   * Useful for testing.
   */
  readonly configDir: string;
}

export const DEFAULT_CLOUD_CONFIG_OPTIONS: CloudConfigOptions = {
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  firstRunTimeoutMs: 2_000,
  backgroundTimeoutMs: 3_000,
  apiBaseUrl: "https://api.anthropic.com",
  configDir: "", // resolved at runtime to ~/.claude
};

// ---------------------------------------------------------------------------
// Type guards and constructors for branded types
// ---------------------------------------------------------------------------

/**
 * Creates a ContentVersion from a plain number.
 * Only call this with values received from the API.
 */
export function toContentVersion(n: number): ContentVersion {
  return n as ContentVersion;
}

/**
 * Creates an ETag from a plain string.
 * Only call this with values received from HTTP headers.
 */
export function toETag(s: string): ETag {
  return s as ETag;
}

/**
 * Creates a ContentHash from a hex-encoded SHA-256 string.
 * Only call this with values computed or received from the API.
 */
export function toContentHash(s: string): ContentHash {
  return s as ContentHash;
}
