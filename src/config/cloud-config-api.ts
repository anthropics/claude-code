/**
 * Cloud-Synced Instructions API Client
 *
 * Complete API contract for the cloud-synced global CLAUDE.md feature.
 * All clients (CLI, VS Code extension, claude.ai, mobile) depend on this contract.
 *
 * Base URL: api.anthropic.com/v1/user
 * Auth: OAuth 2.0 Bearer token (scopes: user:instructions:read, user:instructions:write)
 *
 * Rate limits (per user):
 *   - GET  /instructions/metadata   120 req/min
 *   - GET  /instructions            30 req/min
 *   - PUT  /instructions            10 req/min
 *   - GET  /instructions/history    30 req/min
 *   - GET  /instructions/version/*  30 req/min
 *   - POST /instructions/diff       10 req/min
 */

// ---------------------------------------------------------------------------
// Shared Constants
// ---------------------------------------------------------------------------

/** Maximum size of instructions content in bytes (256 KB). */
const MAX_CONTENT_SIZE_BYTES = 256 * 1024;

/** Default page size for history listing. */
const DEFAULT_HISTORY_LIMIT = 25;

/** Maximum page size for history listing. */
const MAX_HISTORY_LIMIT = 100;

// ---------------------------------------------------------------------------
// Utility Types
// ---------------------------------------------------------------------------

/** ISO 8601 timestamp string (e.g. "2026-02-22T14:30:00.000Z"). */
type ISO8601 = string;

/** SHA-256 hex digest (64 lowercase hex characters). */
type ContentHash = string;

/** ETag value including surrounding quotes (e.g. '"a1b2c3..."'). */
type ETag = string;

/** Monotonically increasing version number (starts at 1). */
type VersionNumber = number;

// ---------------------------------------------------------------------------
// Rate Limit Tracking
// ---------------------------------------------------------------------------

/**
 * Parsed rate limit state from response headers.
 *
 * Follows the IETF RateLimit header fields draft:
 *   https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/
 *
 * Headers consumed:
 *   - RateLimit-Limit:     total requests allowed in the window
 *   - RateLimit-Remaining: requests remaining in the current window
 *   - RateLimit-Reset:     seconds until the window resets
 *   - Retry-After:         seconds to wait before retrying (on 429)
 */
interface RateLimitState {
  /** Total requests allowed in the current window. */
  readonly limit: number;
  /** Requests remaining before throttling. */
  readonly remaining: number;
  /** Seconds until the rate limit window resets. */
  readonly resetInSeconds: number;
  /** Absolute time when the window resets. */
  readonly resetAt: Date;
  /** Present only on 429 responses -- seconds the client must wait. */
  readonly retryAfterSeconds: number | null;
}

// ---------------------------------------------------------------------------
// Error Types (Discriminated Union)
// ---------------------------------------------------------------------------

/**
 * Base shape for all API error responses. Matches Anthropic's existing
 * error envelope: `{ type: "error", error: { type, message } }`.
 */
interface ApiErrorEnvelope {
  readonly type: "error";
  readonly error: {
    readonly type: string;
    readonly message: string;
  };
}

/**
 * 401 -- OAuth token missing, expired, or lacks required scopes.
 *
 * Recovery: re-authenticate via `claude auth login`.
 */
interface AuthenticationError {
  readonly kind: "authentication_error";
  readonly status: 401;
  readonly message: string;
  readonly raw: ApiErrorEnvelope;
}

/**
 * 403 -- Token valid but user lacks permission.
 *
 * Possible causes:
 *   - Enterprise managed settings disabled cloud instructions
 *   - Required OAuth scope not granted
 */
interface ForbiddenError {
  readonly kind: "forbidden_error";
  readonly status: 403;
  readonly message: string;
  readonly scopes: ReadonlyArray<string>;
  readonly raw: ApiErrorEnvelope;
}

/**
 * 404 -- No instructions exist for this user yet.
 *
 * Expected on first use. Client should treat as empty content.
 */
interface NotFoundError {
  readonly kind: "not_found_error";
  readonly status: 404;
  readonly message: string;
  readonly raw: ApiErrorEnvelope;
}

/**
 * 409 -- Conflict during PUT. Another client modified the resource
 * between the caller's read and write. Client must re-fetch, merge,
 * and retry.
 *
 * The response body includes the current server state to avoid an
 * extra round-trip.
 */
interface ConflictError {
  readonly kind: "conflict_error";
  readonly status: 409;
  readonly message: string;
  readonly serverVersion: VersionNumber;
  readonly serverEtag: ETag;
  readonly serverContentHash: ContentHash;
  readonly serverUpdatedAt: ISO8601;
  readonly serverUpdatedByClientId: string;
  readonly raw: ApiErrorEnvelope & {
    readonly error: {
      readonly type: "conflict";
      readonly message: string;
      readonly current_version: VersionNumber;
      readonly current_etag: ETag;
      readonly current_content_hash: ContentHash;
      readonly updated_at: ISO8601;
      readonly updated_by_client_id: string;
    };
  };
}

/**
 * 412 -- Precondition Failed. The `If-Match` ETag does not match the
 * server's current ETag. Semantically identical to 409 for this API
 * but uses the standard HTTP status for conditional request failure.
 *
 * Recovery: re-fetch with GET, then retry the PUT.
 */
interface PreconditionFailedError {
  readonly kind: "precondition_failed_error";
  readonly status: 412;
  readonly message: string;
  readonly serverEtag: ETag;
  readonly raw: ApiErrorEnvelope;
}

/**
 * 422 -- Validation error. Content failed server-side validation.
 *
 * Causes:
 *   - Content exceeds 256 KB
 *   - Content is not valid UTF-8
 *   - Content contains detected secret patterns (warning, not block)
 */
interface ValidationError {
  readonly kind: "validation_error";
  readonly status: 422;
  readonly message: string;
  readonly violations: ReadonlyArray<{
    readonly field: string;
    readonly code: string;
    readonly message: string;
  }>;
  readonly raw: ApiErrorEnvelope;
}

/**
 * 429 -- Rate limited. Client must back off.
 *
 * Recovery: wait `retryAfterSeconds` then retry.
 */
interface RateLimitError {
  readonly kind: "rate_limit_error";
  readonly status: 429;
  readonly message: string;
  readonly retryAfterSeconds: number;
  readonly rateLimit: RateLimitState;
  readonly raw: ApiErrorEnvelope;
}

/**
 * 500/502/503/504 -- Server error. Transient failure.
 *
 * Recovery: exponential backoff with jitter. Max 3 retries.
 * Client should fall back to cached/local content.
 */
interface ServerError {
  readonly kind: "server_error";
  readonly status: 500 | 502 | 503 | 504;
  readonly message: string;
  readonly requestId: string | null;
  readonly raw: ApiErrorEnvelope | null;
}

/**
 * Network-level failure (DNS, timeout, connection refused).
 *
 * Recovery: use cached/local content. Queue operation for retry.
 */
interface NetworkError {
  readonly kind: "network_error";
  readonly status: 0;
  readonly message: string;
  readonly cause: Error;
}

/**
 * Discriminated union of all possible API errors.
 * Use `error.kind` to narrow the type in switch/if statements.
 */
type CloudInstructionsApiError =
  | AuthenticationError
  | ForbiddenError
  | NotFoundError
  | ConflictError
  | PreconditionFailedError
  | ValidationError
  | RateLimitError
  | ServerError
  | NetworkError;

// ---------------------------------------------------------------------------
// Request Types
// ---------------------------------------------------------------------------

/** Headers sent with every authenticated request. */
interface BaseRequestHeaders {
  /** OAuth 2.0 bearer token. */
  readonly Authorization: `Bearer ${string}`;
  /** Client identifier for audit trail (e.g. "cli/1.5.0", "vscode/2.0.0"). */
  readonly "X-Client-Id": string;
  /** Unique request ID for tracing. */
  readonly "X-Request-Id": string;
  /** API version date for forward compatibility. */
  readonly "Anthropic-Version": string;
}

/**
 * GET /v1/user/instructions
 *
 * Downloads the full instructions content. Supports conditional
 * requests via `If-None-Match` to avoid redundant transfers.
 */
interface GetInstructionsRequest {
  readonly headers: BaseRequestHeaders & {
    /** ETag from a previous response. Server returns 304 if unchanged. */
    readonly "If-None-Match"?: ETag;
    readonly Accept: "text/plain";
  };
}

/**
 * PUT /v1/user/instructions
 *
 * Creates or updates instructions content. Uses optimistic concurrency
 * via `If-Match` to prevent lost updates.
 *
 * For first-time creation (no existing content), use `If-Match: *`
 * or omit the header -- the server accepts both for the initial write.
 */
interface PutInstructionsRequest {
  readonly headers: BaseRequestHeaders & {
    /**
     * ETag of the version being replaced. Server rejects with 412 if
     * this does not match the current version.
     *
     * Use "*" for the initial creation when no content exists yet.
     */
    readonly "If-Match": ETag | "*";
    readonly "Content-Type": "text/plain; charset=utf-8";
    /** SHA-256 hex digest of the request body for integrity verification. */
    readonly "Content-SHA256": ContentHash;
  };
  /** Raw UTF-8 instructions content. Max 256 KB. */
  readonly body: string;
}

/**
 * GET /v1/user/instructions/metadata
 *
 * Lightweight metadata check. This is the HOT PATH -- called at every
 * session start to determine if a full fetch is needed. Target: <50ms p99.
 *
 * No request body. No conditional headers needed (always returns current state).
 */
interface GetMetadataRequest {
  readonly headers: BaseRequestHeaders;
}

/**
 * GET /v1/user/instructions/history
 *
 * Paginated version history. Uses cursor-based pagination via
 * `before_version` for stable iteration over a changing list.
 */
interface GetHistoryRequest {
  readonly headers: BaseRequestHeaders;
  readonly query: {
    /**
     * Maximum number of versions to return.
     * Default: 25. Max: 100.
     */
    readonly limit?: number;
    /**
     * Return versions strictly before this version number.
     * Omit for the most recent page.
     */
    readonly before_version?: VersionNumber;
  };
}

/**
 * GET /v1/user/instructions/version/{n}
 *
 * Retrieve a specific historical version by number.
 */
interface GetVersionRequest {
  readonly headers: BaseRequestHeaders & {
    readonly Accept: "text/plain";
  };
  readonly params: {
    readonly version: VersionNumber;
  };
}

/**
 * POST /v1/user/instructions/diff
 *
 * Server-side three-way merge computation. Client sends the base
 * version number and local content; server retrieves both the base
 * and current versions, computes line-based diffs, and returns the
 * merge result.
 *
 * This avoids the client needing to download historical content and
 * implement its own diff algorithm.
 */
interface ComputeDiffRequest {
  readonly headers: BaseRequestHeaders & {
    readonly "Content-Type": "application/json";
  };
  readonly body: {
    /** Version number of the common ancestor (last synced version). */
    readonly base_version: VersionNumber;
    /** The client's current local content. */
    readonly local_content: string;
    /**
     * Server version to diff against. Typically the current latest.
     * If omitted, server uses the latest version.
     */
    readonly server_version?: VersionNumber;
  };
}

// ---------------------------------------------------------------------------
// Response Types
// ---------------------------------------------------------------------------

/** Metadata returned in GET /instructions and PUT /instructions responses. */
interface InstructionsResourceMetadata {
  /** Monotonically increasing version counter. */
  readonly version: VersionNumber;
  /** SHA-256 hex digest of the content. */
  readonly content_hash: ContentHash;
  /** Content size in bytes. */
  readonly content_size_bytes: number;
  /** When this version was created. */
  readonly updated_at: ISO8601;
  /** Which client created this version. */
  readonly updated_by_client_id: string;
}

/**
 * GET /v1/user/instructions -- 200 OK
 *
 * Full content returned. Response headers include ETag and caching directives.
 */
interface GetInstructionsSuccess {
  readonly status: 200;
  readonly headers: {
    /** Strong ETag for the current version. Use in subsequent If-Match/If-None-Match. */
    readonly ETag: ETag;
    /** Always "no-cache" -- clients must revalidate. */
    readonly "Cache-Control": "no-cache";
    /** Content type of the instructions body. */
    readonly "Content-Type": "text/plain; charset=utf-8";
    /** Server-computed SHA-256 of the response body. */
    readonly "Content-SHA256": ContentHash;
    readonly "RateLimit-Limit": string;
    readonly "RateLimit-Remaining": string;
    readonly "RateLimit-Reset": string;
  };
  /** Raw UTF-8 instructions content. */
  readonly body: string;
  /** Parsed metadata from X-Instructions-* headers. */
  readonly metadata: InstructionsResourceMetadata;
}

/**
 * GET /v1/user/instructions -- 304 Not Modified
 *
 * Content has not changed since the ETag provided in If-None-Match.
 * No body returned. Client should use its cached copy.
 */
interface GetInstructionsNotModified {
  readonly status: 304;
  readonly headers: {
    readonly ETag: ETag;
    readonly "RateLimit-Limit": string;
    readonly "RateLimit-Remaining": string;
    readonly "RateLimit-Reset": string;
  };
}

/** Discriminated response for GET /instructions. */
type GetInstructionsResponse =
  | GetInstructionsSuccess
  | GetInstructionsNotModified;

/**
 * PUT /v1/user/instructions -- 200 OK (update) or 201 Created (first write)
 *
 * Returns metadata for the newly created version.
 */
interface PutInstructionsSuccess {
  readonly status: 200 | 201;
  readonly headers: {
    /** ETag of the newly created version. */
    readonly ETag: ETag;
    /** SHA-256 of the stored content (should match what was sent). */
    readonly "Content-SHA256": ContentHash;
    readonly "RateLimit-Limit": string;
    readonly "RateLimit-Remaining": string;
    readonly "RateLimit-Reset": string;
  };
  readonly body: {
    readonly version: VersionNumber;
    readonly content_hash: ContentHash;
    readonly content_size_bytes: number;
    readonly updated_at: ISO8601;
    readonly etag: ETag;
  };
}

type PutInstructionsResponse = PutInstructionsSuccess;

/**
 * GET /v1/user/instructions/metadata -- 200 OK
 *
 * Lightweight response. No content body -- just version info and hash.
 * Used by sync protocol to determine if a full fetch is needed.
 */
interface MetadataSuccess {
  readonly status: 200;
  readonly headers: {
    /** Very short cache. Metadata endpoint is polled frequently. */
    readonly "Cache-Control": "no-cache";
    readonly "RateLimit-Limit": string;
    readonly "RateLimit-Remaining": string;
    readonly "RateLimit-Reset": string;
  };
  readonly body: {
    readonly version: VersionNumber;
    readonly content_hash: ContentHash;
    readonly content_size_bytes: number;
    readonly updated_at: ISO8601;
    readonly updated_by_client_id: string;
    readonly etag: ETag;
  };
}

type MetadataResponse = MetadataSuccess;

/** A single entry in the version history list. */
interface HistoryEntry {
  readonly version: VersionNumber;
  readonly content_hash: ContentHash;
  readonly content_size_bytes: number;
  readonly updated_at: ISO8601;
  readonly updated_by_client_id: string;
  /** Short summary of changes (auto-generated by server). */
  readonly change_summary: string | null;
}

/**
 * GET /v1/user/instructions/history -- 200 OK
 *
 * Cursor-paginated list of versions, most recent first.
 */
interface HistorySuccess {
  readonly status: 200;
  readonly headers: {
    readonly "RateLimit-Limit": string;
    readonly "RateLimit-Remaining": string;
    readonly "RateLimit-Reset": string;
  };
  readonly body: {
    readonly versions: ReadonlyArray<HistoryEntry>;
    /** True if more versions exist before the oldest returned. */
    readonly has_more: boolean;
    /**
     * Version number to pass as `before_version` to fetch the next page.
     * Null if `has_more` is false.
     */
    readonly next_cursor: VersionNumber | null;
  };
}

type HistoryResponse = HistorySuccess;

/**
 * GET /v1/user/instructions/version/{n} -- 200 OK
 *
 * Full content of a specific historical version.
 */
interface VersionSuccess {
  readonly status: 200;
  readonly headers: {
    readonly "Content-Type": "text/plain; charset=utf-8";
    readonly "Content-SHA256": ContentHash;
    readonly "RateLimit-Limit": string;
    readonly "RateLimit-Remaining": string;
    readonly "RateLimit-Reset": string;
  };
  /** Raw content of the historical version. */
  readonly body: string;
  readonly metadata: InstructionsResourceMetadata;
}

type VersionResponse = VersionSuccess;

/** A single hunk in a line-based diff. */
interface DiffHunk {
  /** 1-based starting line in the base content. */
  readonly base_start: number;
  /** Number of lines from the base in this hunk. */
  readonly base_count: number;
  /** 1-based starting line in the target content. */
  readonly target_start: number;
  /** Number of lines in the target for this hunk. */
  readonly target_count: number;
  /** Unified diff lines (prefixed with ' ', '+', or '-'). */
  readonly lines: ReadonlyArray<string>;
}

/** Outcome of the three-way merge computation. */
interface MergeResult {
  /**
   * Whether the merge succeeded automatically or requires user intervention.
   *
   * - "clean": all changes merged without conflicts
   * - "conflicted": overlapping changes detected, manual resolution needed
   */
  readonly status: "clean" | "conflicted";
  /**
   * Merged content. Present for both clean and conflicted merges.
   * For conflicted merges, conflict markers are embedded in the content
   * using standard git-style markers:
   *
   *   <<<<<<< local
   *   (local content)
   *   =======
   *   (server content)
   *   >>>>>>> server (v42, vscode/2.0.0, 2026-02-22T14:30:00Z)
   */
  readonly merged_content: string;
  /** Number of conflict regions (0 for clean merges). */
  readonly conflict_count: number;
  /** Regions where local and server changes overlap. */
  readonly conflicts: ReadonlyArray<{
    /** 1-based line range in the merged content containing this conflict. */
    readonly start_line: number;
    readonly end_line: number;
    /** The local side of the conflict. */
    readonly local_content: string;
    /** The server side of the conflict. */
    readonly server_content: string;
    /** The common ancestor content for this region. */
    readonly base_content: string;
  }>;
}

/**
 * POST /v1/user/instructions/diff -- 200 OK
 *
 * Three-way merge result with diffs from the common ancestor to both
 * the local and server versions, plus the computed merge.
 */
interface DiffSuccess {
  readonly status: 200;
  readonly headers: {
    readonly "RateLimit-Limit": string;
    readonly "RateLimit-Remaining": string;
    readonly "RateLimit-Reset": string;
  };
  readonly body: {
    /** Version used as the common ancestor. */
    readonly base_version: VersionNumber;
    /** Server version that was diffed against. */
    readonly server_version: VersionNumber;
    /** Diff from base to local content. */
    readonly base_to_local: ReadonlyArray<DiffHunk>;
    /** Diff from base to server content. */
    readonly base_to_server: ReadonlyArray<DiffHunk>;
    /** The computed three-way merge result. */
    readonly merge: MergeResult;
  };
}

type DiffResponse = DiffSuccess;

// ---------------------------------------------------------------------------
// Result Type
// ---------------------------------------------------------------------------

/**
 * Every client method returns a Result. Success types vary per endpoint;
 * error types are the shared discriminated union.
 *
 * Usage:
 *   const result = await client.getInstructions();
 *   if (result.ok) {
 *     // result.value is GetInstructionsResponse
 *   } else {
 *     switch (result.error.kind) {
 *       case "not_found_error": // first time user
 *       case "rate_limit_error": // back off
 *       ...
 *     }
 *   }
 */
type Result<T> =
  | { readonly ok: true; readonly value: T; readonly rateLimit: RateLimitState | null }
  | { readonly ok: false; readonly error: CloudInstructionsApiError; readonly rateLimit: RateLimitState | null };

// ---------------------------------------------------------------------------
// Client Configuration
// ---------------------------------------------------------------------------

/** Token provider function -- supports async retrieval from keychain/env. */
type TokenProvider = () => Promise<string>;

interface CloudInstructionsClientConfig {
  /**
   * Base URL for the API.
   * Default: "https://api.anthropic.com/v1/user"
   * Override for testing, staging, or proxy environments.
   */
  readonly baseUrl?: string;

  /**
   * Async function that returns the current OAuth bearer token.
   * Called on every request to support token refresh.
   */
  readonly tokenProvider: TokenProvider;

  /**
   * Client identifier for the X-Client-Id header.
   * Examples: "cli/1.5.0", "vscode/2.0.0", "web/1.0.0", "mobile-ios/1.0.0"
   */
  readonly clientId: string;

  /**
   * Anthropic API version date string.
   * Default: "2026-02-01"
   */
  readonly apiVersion?: string;

  /**
   * Request timeout in milliseconds.
   * Default: 10_000 (10 seconds)
   * Metadata endpoint uses half this value for faster fallback.
   */
  readonly timeoutMs?: number;

  /**
   * Maximum automatic retries for transient errors (5xx, network).
   * Default: 3
   * Uses exponential backoff with jitter.
   */
  readonly maxRetries?: number;

  /**
   * Custom fetch implementation for testing/mocking.
   * Default: globalThis.fetch
   */
  readonly fetch?: typeof globalThis.fetch;

  /**
   * Optional callback invoked with rate limit state after every response.
   * Useful for UI indicators or preemptive throttling.
   */
  readonly onRateLimit?: (endpoint: string, state: RateLimitState) => void;
}

// ---------------------------------------------------------------------------
// Content Hash Utility
// ---------------------------------------------------------------------------

/**
 * Computes the SHA-256 hex digest of UTF-8 content.
 *
 * Uses the Web Crypto API (available in Node 18+, Bun, Deno, and browsers).
 * This is the canonical hash function used for content integrity across
 * all clients and the server.
 *
 * @param content - UTF-8 string to hash
 * @returns Lowercase hex SHA-256 digest (64 characters)
 *
 * @example
 * ```ts
 * const hash = await computeContentHash("# My Instructions\n...");
 * // => "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 */
async function computeContentHash(content: string): Promise<ContentHash> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Request ID Generation
// ---------------------------------------------------------------------------

/**
 * Generates a unique request ID for tracing.
 * Format: "req_{timestamp_hex}_{random_hex}" (e.g. "req_18d4f2a1b_a3f7c9e2")
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(16);
  const random = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `req_${timestamp}_${random}`;
}

// ---------------------------------------------------------------------------
// Rate Limit Header Parser
// ---------------------------------------------------------------------------

function parseRateLimitHeaders(headers: Headers): RateLimitState | null {
  const limitStr = headers.get("RateLimit-Limit");
  const remainingStr = headers.get("RateLimit-Remaining");
  const resetStr = headers.get("RateLimit-Reset");

  if (limitStr === null || remainingStr === null || resetStr === null) {
    return null;
  }

  const limit = parseInt(limitStr, 10);
  const remaining = parseInt(remainingStr, 10);
  const resetInSeconds = parseInt(resetStr, 10);

  if (Number.isNaN(limit) || Number.isNaN(remaining) || Number.isNaN(resetInSeconds)) {
    return null;
  }

  const retryAfterStr = headers.get("Retry-After");
  const retryAfterSeconds = retryAfterStr !== null ? parseInt(retryAfterStr, 10) : null;

  return {
    limit,
    remaining,
    resetInSeconds,
    resetAt: new Date(Date.now() + resetInSeconds * 1000),
    retryAfterSeconds: retryAfterSeconds !== null && !Number.isNaN(retryAfterSeconds)
      ? retryAfterSeconds
      : null,
  };
}

// ---------------------------------------------------------------------------
// Error Parsing
// ---------------------------------------------------------------------------

async function parseErrorBody(response: Response): Promise<ApiErrorEnvelope | null> {
  try {
    const text = await response.text();
    const parsed = JSON.parse(text) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "type" in parsed &&
      (parsed as Record<string, unknown>).type === "error" &&
      "error" in parsed
    ) {
      return parsed as ApiErrorEnvelope;
    }
    return null;
  } catch {
    return null;
  }
}

async function classifyError(
  response: Response,
  rateLimit: RateLimitState | null,
): Promise<CloudInstructionsApiError> {
  const status = response.status;
  const envelope = await parseErrorBody(response);
  const fallbackMessage = envelope?.error.message ?? `HTTP ${status}: ${response.statusText}`;

  switch (status) {
    case 401:
      return {
        kind: "authentication_error",
        status: 401,
        message: fallbackMessage,
        raw: envelope ?? { type: "error", error: { type: "authentication_error", message: fallbackMessage } },
      };

    case 403:
      return {
        kind: "forbidden_error",
        status: 403,
        message: fallbackMessage,
        scopes: ["user:instructions:read", "user:instructions:write"],
        raw: envelope ?? { type: "error", error: { type: "forbidden", message: fallbackMessage } },
      };

    case 404:
      return {
        kind: "not_found_error",
        status: 404,
        message: "No instructions found for this user.",
        raw: envelope ?? { type: "error", error: { type: "not_found", message: "No instructions found." } },
      };

    case 409: {
      const conflictData = envelope?.error as Record<string, unknown> | undefined;
      return {
        kind: "conflict_error",
        status: 409,
        message: fallbackMessage,
        serverVersion: (conflictData?.current_version as VersionNumber) ?? 0,
        serverEtag: (conflictData?.current_etag as ETag) ?? "",
        serverContentHash: (conflictData?.current_content_hash as ContentHash) ?? "",
        serverUpdatedAt: (conflictData?.updated_at as ISO8601) ?? "",
        serverUpdatedByClientId: (conflictData?.updated_by_client_id as string) ?? "",
        raw: envelope as ConflictError["raw"],
      };
    }

    case 412:
      return {
        kind: "precondition_failed_error",
        status: 412,
        message: "ETag mismatch. The resource was modified by another client.",
        serverEtag: response.headers.get("ETag") ?? "",
        raw: envelope ?? { type: "error", error: { type: "precondition_failed", message: fallbackMessage } },
      };

    case 422: {
      const validationData = envelope?.error as Record<string, unknown> | undefined;
      const violations = Array.isArray(validationData?.violations)
        ? (validationData.violations as ValidationError["violations"])
        : [];
      return {
        kind: "validation_error",
        status: 422,
        message: fallbackMessage,
        violations,
        raw: envelope ?? { type: "error", error: { type: "validation_error", message: fallbackMessage } },
      };
    }

    case 429: {
      const retryAfterStr = response.headers.get("Retry-After");
      const retryAfterSeconds = retryAfterStr !== null ? parseInt(retryAfterStr, 10) : 60;
      return {
        kind: "rate_limit_error",
        status: 429,
        message: fallbackMessage,
        retryAfterSeconds: Number.isNaN(retryAfterSeconds) ? 60 : retryAfterSeconds,
        rateLimit: rateLimit ?? {
          limit: 0,
          remaining: 0,
          resetInSeconds: retryAfterSeconds,
          resetAt: new Date(Date.now() + (Number.isNaN(retryAfterSeconds) ? 60 : retryAfterSeconds) * 1000),
          retryAfterSeconds: Number.isNaN(retryAfterSeconds) ? 60 : retryAfterSeconds,
        },
        raw: envelope ?? { type: "error", error: { type: "rate_limit_error", message: fallbackMessage } },
      };
    }

    default: {
      if (status >= 500) {
        return {
          kind: "server_error",
          status: status as ServerError["status"],
          message: fallbackMessage,
          requestId: response.headers.get("X-Request-Id"),
          raw: envelope,
        };
      }
      // Unexpected status code -- treat as server error.
      return {
        kind: "server_error",
        status: 500,
        message: `Unexpected status ${status}: ${fallbackMessage}`,
        requestId: response.headers.get("X-Request-Id"),
        raw: envelope,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Retry Logic
// ---------------------------------------------------------------------------

function isRetryableError(error: CloudInstructionsApiError): boolean {
  return error.kind === "server_error" || error.kind === "network_error";
}

function computeBackoffMs(attempt: number): number {
  // Exponential backoff: 500ms, 1s, 2s, 4s... with +/- 25% jitter.
  const baseMs = 500 * Math.pow(2, attempt);
  const jitter = baseMs * 0.25 * (Math.random() * 2 - 1);
  return Math.min(baseMs + jitter, 30_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Client Implementation
// ---------------------------------------------------------------------------

/**
 * Cloud Instructions API Client.
 *
 * Provides typed access to all 6 endpoints of the cloud-synced instructions API.
 * Handles authentication, content hashing, rate limit tracking, retries with
 * exponential backoff, and comprehensive error classification.
 *
 * Design decisions:
 *   - Returns `Result<T>` instead of throwing, so callers handle errors explicitly.
 *   - Every error is a discriminated union case -- no catching generic `Error`.
 *   - Injectable `fetch` and `tokenProvider` for full testability.
 *   - Rate limit state exposed per-response and via callback for UI integration.
 *   - Content hash computed client-side for integrity verification.
 *
 * @example
 * ```ts
 * const client = new CloudInstructionsClient({
 *   tokenProvider: async () => getStoredToken(),
 *   clientId: "cli/1.5.0",
 * });
 *
 * // Check if instructions changed since last sync
 * const meta = await client.getMetadata();
 * if (meta.ok && meta.value.body.content_hash !== localHash) {
 *   const content = await client.getInstructions();
 *   if (content.ok && content.value.status === 200) {
 *     writeLocalFile(content.value.body);
 *   }
 * }
 * ```
 */
class CloudInstructionsClient {
  private readonly baseUrl: string;
  private readonly tokenProvider: TokenProvider;
  private readonly clientId: string;
  private readonly apiVersion: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly onRateLimit: ((endpoint: string, state: RateLimitState) => void) | null;

  /** Most recent rate limit state per endpoint path, for preemptive checking. */
  private readonly rateLimitCache: Map<string, RateLimitState> = new Map();

  constructor(config: CloudInstructionsClientConfig) {
    this.baseUrl = (config.baseUrl ?? "https://api.anthropic.com/v1/user").replace(/\/$/, "");
    this.tokenProvider = config.tokenProvider;
    this.clientId = config.clientId;
    this.apiVersion = config.apiVersion ?? "2026-02-01";
    this.timeoutMs = config.timeoutMs ?? 10_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.onRateLimit = config.onRateLimit ?? null;
  }

  // -----------------------------------------------------------------------
  // Public API Methods
  // -----------------------------------------------------------------------

  /**
   * GET /v1/user/instructions
   *
   * Downloads the user's instructions content. If an ETag is provided, the
   * server may return 304 Not Modified, saving bandwidth and parse time.
   *
   * Rate limit: 30 req/min
   *
   * @param etag - Optional ETag from a previous response for conditional fetch.
   * @returns Instructions content (200) or not-modified signal (304).
   *
   * @example
   * ```ts
   * // First fetch -- no ETag
   * const result = await client.getInstructions();
   * if (result.ok && result.value.status === 200) {
   *   const content = result.value.body;     // "# My Instructions\n..."
   *   const etag = result.value.headers.ETag; // '"v42-a1b2c3..."'
   *   cache.save(content, etag);
   * }
   *
   * // Subsequent fetch -- with ETag
   * const refresh = await client.getInstructions(cachedEtag);
   * if (refresh.ok && refresh.value.status === 304) {
   *   // Content unchanged, keep using cache
   * }
   * ```
   *
   * @example Error handling
   * ```ts
   * const result = await client.getInstructions();
   * if (!result.ok) {
   *   switch (result.error.kind) {
   *     case "not_found_error":
   *       // User has no instructions yet -- treat as empty
   *       break;
   *     case "authentication_error":
   *       // Token expired -- prompt re-auth
   *       break;
   *     case "network_error":
   *       // Offline -- use local file
   *       break;
   *   }
   * }
   * ```
   */
  async getInstructions(etag?: string): Promise<Result<GetInstructionsResponse>> {
    const headers: Record<string, string> = {
      Accept: "text/plain",
    };
    if (etag !== undefined) {
      headers["If-None-Match"] = etag;
    }

    return this.executeWithRetry<GetInstructionsResponse>(
      "GET",
      "/instructions",
      headers,
      undefined,
      async (response, rateLimit) => {
        if (response.status === 304) {
          const value: GetInstructionsNotModified = {
            status: 304,
            headers: {
              ETag: response.headers.get("ETag") ?? "",
              "RateLimit-Limit": response.headers.get("RateLimit-Limit") ?? "",
              "RateLimit-Remaining": response.headers.get("RateLimit-Remaining") ?? "",
              "RateLimit-Reset": response.headers.get("RateLimit-Reset") ?? "",
            },
          };
          return { ok: true, value, rateLimit };
        }

        const body = await response.text();
        const versionHeader = response.headers.get("X-Instructions-Version");
        const hashHeader = response.headers.get("Content-SHA256") ?? response.headers.get("X-Instructions-Content-Hash");
        const sizeHeader = response.headers.get("Content-Length");
        const updatedAtHeader = response.headers.get("X-Instructions-Updated-At");
        const clientIdHeader = response.headers.get("X-Instructions-Updated-By");

        const value: GetInstructionsSuccess = {
          status: 200,
          headers: {
            ETag: response.headers.get("ETag") ?? "",
            "Cache-Control": "no-cache",
            "Content-Type": "text/plain; charset=utf-8",
            "Content-SHA256": hashHeader ?? "",
            "RateLimit-Limit": response.headers.get("RateLimit-Limit") ?? "",
            "RateLimit-Remaining": response.headers.get("RateLimit-Remaining") ?? "",
            "RateLimit-Reset": response.headers.get("RateLimit-Reset") ?? "",
          },
          body,
          metadata: {
            version: versionHeader !== null ? parseInt(versionHeader, 10) : 0,
            content_hash: hashHeader ?? "",
            content_size_bytes: sizeHeader !== null ? parseInt(sizeHeader, 10) : new TextEncoder().encode(body).byteLength,
            updated_at: updatedAtHeader ?? "",
            updated_by_client_id: clientIdHeader ?? "",
          },
        };
        return { ok: true, value, rateLimit };
      },
    );
  }

  /**
   * PUT /v1/user/instructions
   *
   * Creates or updates the user's instructions. Uses optimistic concurrency
   * via the `If-Match` header to prevent lost updates in multi-device scenarios.
   *
   * The client computes the SHA-256 hash of the content and sends it in the
   * `Content-SHA256` header. The server verifies integrity on receipt.
   *
   * Rate limit: 10 req/min
   *
   * @param content - UTF-8 instructions content. Max 256 KB.
   * @param etag    - ETag of the version being replaced. Use "*" for initial creation.
   * @param clientId - Override client ID for this request (optional, uses configured default).
   * @returns Metadata of the newly created version.
   *
   * @example
   * ```ts
   * // Update existing instructions
   * const result = await client.putInstructions(newContent, currentEtag);
   * if (result.ok) {
   *   const { version, etag } = result.value.body;
   *   cache.update(newContent, etag, version);
   * }
   * ```
   *
   * @example Handling conflicts
   * ```ts
   * const result = await client.putInstructions(content, staleEtag);
   * if (!result.ok && result.error.kind === "conflict_error") {
   *   // Another device updated. Use three-way merge.
   *   const diff = await client.computeDiff(lastSyncedVersion, content);
   *   if (diff.ok && diff.value.body.merge.status === "clean") {
   *     // Auto-merged. Retry PUT with merged content.
   *     await client.putInstructions(
   *       diff.value.body.merge.merged_content,
   *       result.error.serverEtag,
   *     );
   *   } else {
   *     // Conflicts. Escalate to user.
   *   }
   * }
   * ```
   *
   * @example First-time creation
   * ```ts
   * const result = await client.putInstructions(initialContent, "*");
   * if (result.ok && result.value.status === 201) {
   *   // Instructions created for the first time
   * }
   * ```
   *
   * @throws Never -- all errors are returned in the Result.
   */
  async putInstructions(
    content: string,
    etag: string,
    clientId?: string,
  ): Promise<Result<PutInstructionsResponse>> {
    const contentBytes = new TextEncoder().encode(content);
    if (contentBytes.byteLength > MAX_CONTENT_SIZE_BYTES) {
      const error: ValidationError = {
        kind: "validation_error",
        status: 422,
        message: `Content size ${contentBytes.byteLength} bytes exceeds maximum of ${MAX_CONTENT_SIZE_BYTES} bytes (256 KB).`,
        violations: [
          {
            field: "content",
            code: "max_size_exceeded",
            message: `Content is ${contentBytes.byteLength} bytes, maximum is ${MAX_CONTENT_SIZE_BYTES} bytes.`,
          },
        ],
        raw: {
          type: "error",
          error: {
            type: "validation_error",
            message: "Content exceeds maximum size.",
          },
        },
      };
      return { ok: false, error, rateLimit: null };
    }

    const contentHash = await computeContentHash(content);

    const headers: Record<string, string> = {
      "If-Match": etag,
      "Content-Type": "text/plain; charset=utf-8",
      "Content-SHA256": contentHash,
    };

    if (clientId !== undefined) {
      headers["X-Client-Id-Override"] = clientId;
    }

    return this.executeWithRetry<PutInstructionsResponse>(
      "PUT",
      "/instructions",
      headers,
      content,
      async (response, rateLimit) => {
        const responseBody = await response.json() as PutInstructionsSuccess["body"];
        const value: PutInstructionsSuccess = {
          status: response.status as 200 | 201,
          headers: {
            ETag: response.headers.get("ETag") ?? "",
            "Content-SHA256": response.headers.get("Content-SHA256") ?? contentHash,
            "RateLimit-Limit": response.headers.get("RateLimit-Limit") ?? "",
            "RateLimit-Remaining": response.headers.get("RateLimit-Remaining") ?? "",
            "RateLimit-Reset": response.headers.get("RateLimit-Reset") ?? "",
          },
          body: responseBody,
        };
        return { ok: true, value, rateLimit };
      },
    );
  }

  /**
   * GET /v1/user/instructions/metadata
   *
   * Lightweight metadata check -- the HOT PATH of the sync protocol.
   * Called at every session start to determine whether a full GET is needed.
   * The server targets <50ms p99 for this endpoint.
   *
   * This endpoint uses half the configured timeout (default: 5s) so that
   * session startup is never blocked for long. On timeout, the client falls
   * back to cached content.
   *
   * Rate limit: 120 req/min
   *
   * @returns Current version, content hash, and ETag.
   *
   * @example
   * ```ts
   * const meta = await client.getMetadata();
   * if (meta.ok) {
   *   if (meta.value.body.content_hash !== localCache.hash) {
   *     // Content changed -- fetch full content
   *     const full = await client.getInstructions();
   *     // ...
   *   }
   * } else if (meta.error.kind === "network_error") {
   *   // Offline -- use local cache
   * }
   * ```
   */
  async getMetadata(): Promise<Result<MetadataResponse>> {
    return this.executeWithRetry<MetadataResponse>(
      "GET",
      "/instructions/metadata",
      {},
      undefined,
      async (response, rateLimit) => {
        const body = await response.json() as MetadataSuccess["body"];
        const value: MetadataSuccess = {
          status: 200,
          headers: {
            "Cache-Control": "no-cache",
            "RateLimit-Limit": response.headers.get("RateLimit-Limit") ?? "",
            "RateLimit-Remaining": response.headers.get("RateLimit-Remaining") ?? "",
            "RateLimit-Reset": response.headers.get("RateLimit-Reset") ?? "",
          },
          body,
        };
        return { ok: true, value, rateLimit };
      },
      Math.floor(this.timeoutMs / 2), // Half timeout for the hot path
    );
  }

  /**
   * GET /v1/user/instructions/history
   *
   * Lists version history with cursor-based pagination. Versions are
   * returned in reverse chronological order (most recent first).
   *
   * Use `before_version` from `next_cursor` to paginate forward through
   * older versions.
   *
   * Rate limit: 30 req/min
   *
   * @param limit - Maximum entries per page (default: 25, max: 100).
   * @param beforeVersion - Cursor: return versions before this number.
   * @returns Paginated list of version metadata.
   *
   * @example
   * ```ts
   * // First page
   * const page1 = await client.getHistory(10);
   * if (page1.ok) {
   *   for (const v of page1.value.body.versions) {
   *     console.log(`v${v.version}: ${v.updated_at} by ${v.updated_by_client_id}`);
   *   }
   *   if (page1.value.body.has_more) {
   *     const page2 = await client.getHistory(10, page1.value.body.next_cursor!);
   *     // ...
   *   }
   * }
   * ```
   */
  async getHistory(
    limit?: number,
    beforeVersion?: VersionNumber,
  ): Promise<Result<HistoryResponse>> {
    const queryParts: Array<string> = [];
    if (limit !== undefined) {
      const clampedLimit = Math.min(Math.max(1, limit), MAX_HISTORY_LIMIT);
      queryParts.push(`limit=${clampedLimit}`);
    }
    if (beforeVersion !== undefined) {
      queryParts.push(`before_version=${beforeVersion}`);
    }
    const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

    return this.executeWithRetry<HistoryResponse>(
      "GET",
      `/instructions/history${queryString}`,
      {},
      undefined,
      async (response, rateLimit) => {
        const body = await response.json() as HistorySuccess["body"];
        const value: HistorySuccess = {
          status: 200,
          headers: {
            "RateLimit-Limit": response.headers.get("RateLimit-Limit") ?? "",
            "RateLimit-Remaining": response.headers.get("RateLimit-Remaining") ?? "",
            "RateLimit-Reset": response.headers.get("RateLimit-Reset") ?? "",
          },
          body,
        };
        return { ok: true, value, rateLimit };
      },
    );
  }

  /**
   * GET /v1/user/instructions/version/{n}
   *
   * Retrieves the full content of a specific historical version.
   * Used for three-way merge (fetching the common ancestor) and
   * the `claude instructions sync restore {version}` command.
   *
   * Rate limit: 30 req/min
   *
   * @param version - The version number to retrieve.
   * @returns Full content and metadata for the requested version.
   *
   * @example
   * ```ts
   * const result = await client.getVersion(41);
   * if (result.ok) {
   *   console.log(`Version 41 (${result.value.metadata.updated_at}):`);
   *   console.log(result.value.body);
   * } else if (result.error.kind === "not_found_error") {
   *   console.log("Version 41 does not exist or has been archived.");
   * }
   * ```
   */
  async getVersion(version: VersionNumber): Promise<Result<VersionResponse>> {
    return this.executeWithRetry<VersionResponse>(
      "GET",
      `/instructions/version/${version}`,
      { Accept: "text/plain" },
      undefined,
      async (response, rateLimit) => {
        const body = await response.text();
        const versionHeader = response.headers.get("X-Instructions-Version");
        const hashHeader = response.headers.get("Content-SHA256") ?? response.headers.get("X-Instructions-Content-Hash");
        const sizeHeader = response.headers.get("Content-Length");
        const updatedAtHeader = response.headers.get("X-Instructions-Updated-At");
        const clientIdHeader = response.headers.get("X-Instructions-Updated-By");

        const value: VersionSuccess = {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-SHA256": hashHeader ?? "",
            "RateLimit-Limit": response.headers.get("RateLimit-Limit") ?? "",
            "RateLimit-Remaining": response.headers.get("RateLimit-Remaining") ?? "",
            "RateLimit-Reset": response.headers.get("RateLimit-Reset") ?? "",
          },
          body,
          metadata: {
            version: versionHeader !== null ? parseInt(versionHeader, 10) : version,
            content_hash: hashHeader ?? "",
            content_size_bytes: sizeHeader !== null ? parseInt(sizeHeader, 10) : new TextEncoder().encode(body).byteLength,
            updated_at: updatedAtHeader ?? "",
            updated_by_client_id: clientIdHeader ?? "",
          },
        };
        return { ok: true, value, rateLimit };
      },
    );
  }

  /**
   * POST /v1/user/instructions/diff
   *
   * Computes a server-side three-way merge between the common ancestor,
   * the client's local content, and the current server content.
   *
   * The server:
   *   1. Retrieves the base version content
   *   2. Retrieves the target server version content
   *   3. Computes line-based diffs (base -> local, base -> server)
   *   4. Performs three-way merge
   *   5. Returns diffs and merge result (clean or conflicted)
   *
   * For conflicted merges, the `merged_content` contains git-style conflict
   * markers that can be presented to the user for manual resolution.
   *
   * Rate limit: 10 req/min
   *
   * @param baseVersion    - Version number of the common ancestor.
   * @param localContent   - The client's current local content.
   * @param serverVersion  - Server version to merge against (default: latest).
   * @returns Three-way diff with merge result.
   *
   * @example Clean merge
   * ```ts
   * const diff = await client.computeDiff(40, localContent, 42);
   * if (diff.ok && diff.value.body.merge.status === "clean") {
   *   // Auto-merge succeeded. Push the merged content.
   *   const merged = diff.value.body.merge.merged_content;
   *   await client.putInstructions(merged, currentEtag);
   * }
   * ```
   *
   * @example Conflicted merge
   * ```ts
   * const diff = await client.computeDiff(40, localContent, 42);
   * if (diff.ok && diff.value.body.merge.status === "conflicted") {
   *   const { conflict_count, conflicts, merged_content } = diff.value.body.merge;
   *   console.log(`${conflict_count} conflict(s) detected.`);
   *   // Present to user:
   *   //   [K]eep local | [T]ake remote | [M]erge manually | [D]iff
   * }
   * ```
   */
  async computeDiff(
    baseVersion: VersionNumber,
    localContent: string,
    serverVersion?: VersionNumber,
  ): Promise<Result<DiffResponse>> {
    const requestBody: ComputeDiffRequest["body"] = {
      base_version: baseVersion,
      local_content: localContent,
      ...(serverVersion !== undefined && { server_version: serverVersion }),
    };

    return this.executeWithRetry<DiffResponse>(
      "POST",
      "/instructions/diff",
      { "Content-Type": "application/json" },
      JSON.stringify(requestBody),
      async (response, rateLimit) => {
        const body = await response.json() as DiffSuccess["body"];
        const value: DiffSuccess = {
          status: 200,
          headers: {
            "RateLimit-Limit": response.headers.get("RateLimit-Limit") ?? "",
            "RateLimit-Remaining": response.headers.get("RateLimit-Remaining") ?? "",
            "RateLimit-Reset": response.headers.get("RateLimit-Reset") ?? "",
          },
          body,
        };
        return { ok: true, value, rateLimit };
      },
    );
  }

  // -----------------------------------------------------------------------
  // Rate Limit Inspection
  // -----------------------------------------------------------------------

  /**
   * Returns the most recently observed rate limit state for an endpoint.
   *
   * Callers can use this to implement preemptive throttling (e.g., skip
   * a sync attempt if remaining requests are low).
   *
   * @param endpoint - Endpoint path (e.g. "/instructions", "/instructions/metadata").
   * @returns Most recent rate limit state, or null if not yet observed.
   */
  getRateLimitState(endpoint: string): RateLimitState | null {
    return this.rateLimitCache.get(endpoint) ?? null;
  }

  // -----------------------------------------------------------------------
  // Internal: Request Execution with Retry
  // -----------------------------------------------------------------------

  private async executeWithRetry<T>(
    method: string,
    path: string,
    extraHeaders: Record<string, string>,
    body: string | undefined,
    onSuccess: (response: Response, rateLimit: RateLimitState | null) => Promise<Result<T>>,
    timeoutOverrideMs?: number,
  ): Promise<Result<T>> {
    const effectiveTimeout = timeoutOverrideMs ?? this.timeoutMs;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const result = await this.executeOnce<T>(method, path, extraHeaders, body, onSuccess, effectiveTimeout);

      if (result.ok) {
        return result;
      }

      // Only retry transient errors, and not on the last attempt.
      if (!isRetryableError(result.error) || attempt === this.maxRetries) {
        return result;
      }

      // For rate limit errors, respect the Retry-After header.
      if (result.error.kind === "rate_limit_error") {
        await sleep(result.error.retryAfterSeconds * 1000);
        continue;
      }

      await sleep(computeBackoffMs(attempt));
    }

    // Unreachable, but TypeScript needs it.
    return {
      ok: false,
      error: {
        kind: "server_error",
        status: 500,
        message: "Retry loop exhausted.",
        requestId: null,
        raw: null,
      },
      rateLimit: null,
    };
  }

  private async executeOnce<T>(
    method: string,
    path: string,
    extraHeaders: Record<string, string>,
    body: string | undefined,
    onSuccess: (response: Response, rateLimit: RateLimitState | null) => Promise<Result<T>>,
    timeoutMs: number,
  ): Promise<Result<T>> {
    let token: string;
    try {
      token = await this.tokenProvider();
    } catch (cause) {
      const error: AuthenticationError = {
        kind: "authentication_error",
        status: 401,
        message: cause instanceof Error
          ? `Failed to retrieve auth token: ${cause.message}`
          : "Failed to retrieve auth token.",
        raw: { type: "error", error: { type: "authentication_error", message: "Token provider failed." } },
      };
      return { ok: false, error, rateLimit: null };
    }

    const requestId = generateRequestId();
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "X-Client-Id": this.clientId,
      "X-Request-Id": requestId,
      "Anthropic-Version": this.apiVersion,
      ...extraHeaders,
    };

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method,
        headers,
        body: body ?? undefined,
        signal: controller.signal,
      });
    } catch (cause) {
      clearTimeout(timeoutHandle);

      const isAbort = cause instanceof DOMException && cause.name === "AbortError";
      const networkError: NetworkError = {
        kind: "network_error",
        status: 0,
        message: isAbort
          ? `Request timed out after ${timeoutMs}ms: ${method} ${path}`
          : `Network error: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause: cause instanceof Error ? cause : new Error(String(cause)),
      };
      return { ok: false, error: networkError, rateLimit: null };
    } finally {
      clearTimeout(timeoutHandle);
    }

    const rateLimit = parseRateLimitHeaders(response.headers);
    if (rateLimit !== null) {
      this.rateLimitCache.set(path.split("?")[0], rateLimit);
      if (this.onRateLimit !== null) {
        this.onRateLimit(path.split("?")[0], rateLimit);
      }
    }

    // Success range: 200, 201, 304
    if (response.ok || response.status === 304) {
      return onSuccess(response, rateLimit);
    }

    // Error: classify and return
    const error = await classifyError(response, rateLimit);
    return { ok: false, error, rateLimit };
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  // Client
  CloudInstructionsClient,
  type CloudInstructionsClientConfig,
  type TokenProvider,

  // Result type
  type Result,

  // Response types
  type GetInstructionsResponse,
  type GetInstructionsSuccess,
  type GetInstructionsNotModified,
  type PutInstructionsResponse,
  type PutInstructionsSuccess,
  type MetadataResponse,
  type MetadataSuccess,
  type HistoryResponse,
  type HistorySuccess,
  type HistoryEntry,
  type VersionResponse,
  type VersionSuccess,
  type DiffResponse,
  type DiffSuccess,
  type DiffHunk,
  type MergeResult,

  // Request types
  type GetInstructionsRequest,
  type PutInstructionsRequest,
  type GetMetadataRequest,
  type GetHistoryRequest,
  type GetVersionRequest,
  type ComputeDiffRequest,
  type BaseRequestHeaders,

  // Error types
  type CloudInstructionsApiError,
  type AuthenticationError,
  type ForbiddenError,
  type NotFoundError,
  type ConflictError,
  type PreconditionFailedError,
  type ValidationError,
  type RateLimitError,
  type ServerError,
  type NetworkError,
  type ApiErrorEnvelope,

  // Metadata types
  type InstructionsResourceMetadata,
  type RateLimitState,

  // Utility types
  type ISO8601,
  type ContentHash,
  type ETag,
  type VersionNumber,

  // Utility functions
  computeContentHash,
  generateRequestId,
  parseRateLimitHeaders,

  // Constants
  MAX_CONTENT_SIZE_BYTES,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
};
