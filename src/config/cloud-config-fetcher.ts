/**
 * HTTP client for the Anthropic cloud instructions API.
 *
 * Responsibilities:
 * - Fetch and update user instructions via the Anthropic API
 * - ETag-based conditional requests (If-None-Match for reads, If-Match for writes)
 * - AbortController with configurable timeouts (2s first-run, 3s background)
 * - Correct handling of all status codes: 200/201, 304, 404, 409/412, 429, 401/403, 5xx
 * - Content hash (SHA-256) computation and comparison
 * - Version history retrieval for `claude instructions sync history/restore`
 * - No retry logic: fail fast, retry on next session
 */

import type {
  CloudConfigOptions,
  ContentHash,
  ContentVersion,
  ETag,
  FetchResult,
  HistoryEntry,
  HistoryPage,
  InstructionsResponse,
} from "./cloud-config-types.js";
import {
  DEFAULT_CLOUD_CONFIG_OPTIONS,
  toContentHash,
  toContentVersion,
  toETag,
} from "./cloud-config-types.js";
import { computeContentHash } from "./cloud-config-cache.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INSTRUCTIONS_PATH = "/v1/user/instructions";
const METADATA_PATH = "/v1/user/instructions/metadata";
const HISTORY_PATH = "/v1/user/instructions/history";
const VERSION_PATH = "/v1/user/instructions/version";

/**
 * User-Agent header sent with all requests. Identifies the client for
 * server-side analytics and rate limiting buckets.
 */
const USER_AGENT = "claude-code-cli/cloud-config";

/** Timeout for explicit CLI operations (history, restore, push/pull) */
const CLI_OPERATION_TIMEOUT_MS = 5_000;

/**
 * Maximum response body size in bytes. The spec limits content to 256KB;
 * this matches the contracted limit. JSON envelope overhead is negligible.
 */
const MAX_RESPONSE_BODY_BYTES = 256 * 1024;

type RequestKind = "instructions" | "metadata" | "version";

// ---------------------------------------------------------------------------
// Public API: Read instructions
// ---------------------------------------------------------------------------

/**
 * Fetches the full instructions content from the API.
 *
 * If `currentEtag` is provided, sends an `If-None-Match` header so the
 * server can return 304 when the content has not changed.
 *
 * @param authToken  OAuth bearer token
 * @param timeoutMs  Request timeout in milliseconds
 * @param currentEtag  Optional ETag from the local cache for conditional request
 * @param options  API configuration overrides
 */
export async function fetchInstructions(
  authToken: string,
  timeoutMs: number,
  currentEtag: ETag | null,
  options: Partial<CloudConfigOptions> = {},
): Promise<FetchResult> {
  const baseUrl = options.apiBaseUrl ?? DEFAULT_CLOUD_CONFIG_OPTIONS.apiBaseUrl;
  const url = `${baseUrl}${INSTRUCTIONS_PATH}`;

  const headers: Record<string, string> = {
    ...buildCommonHeaders(authToken),
    Accept: "text/plain, application/json",
  };
  if (currentEtag !== null) {
    headers["If-None-Match"] = currentEtag;
  }

  return executeRequest(url, { method: "GET", headers }, timeoutMs, "instructions");
}

// ---------------------------------------------------------------------------
// Public API: Read metadata (hot path)
// ---------------------------------------------------------------------------

/**
 * Fetches only the metadata (version, hash, etag) without the full content.
 * This is the hot-path check: <50ms p99 on the server side.
 */
export async function fetchMetadata(
  authToken: string,
  timeoutMs: number,
  options: Partial<CloudConfigOptions> = {},
): Promise<FetchResult> {
  const baseUrl = options.apiBaseUrl ?? DEFAULT_CLOUD_CONFIG_OPTIONS.apiBaseUrl;
  const url = `${baseUrl}${METADATA_PATH}`;

  const headers = buildCommonHeaders(authToken);

  return executeRequest(url, { method: "GET", headers }, timeoutMs, "metadata");
}

// ---------------------------------------------------------------------------
// Public API: Write instructions
// ---------------------------------------------------------------------------

/**
 * Uploads new or updated instructions to the cloud.
 *
 * Uses `If-Match` with the current ETag for optimistic concurrency control.
 * Returns `conflict` if the server version has advanced since our last read.
 *
 * @param authToken  OAuth bearer token
 * @param content  The CLAUDE.md content to upload
 * @param currentEtag  ETag from the last successful GET (required for concurrency)
 * @param timeoutMs  Request timeout in milliseconds
 * @param options  API configuration overrides
 */
export async function putInstructions(
  authToken: string,
  content: string,
  currentEtag: ETag | null,
  timeoutMs: number,
  options: Partial<CloudConfigOptions> = {},
): Promise<FetchResult> {
  const baseUrl = options.apiBaseUrl ?? DEFAULT_CLOUD_CONFIG_OPTIONS.apiBaseUrl;
  const url = `${baseUrl}${INSTRUCTIONS_PATH}`;

  const headers: Record<string, string> = {
    ...buildCommonHeaders(authToken),
    "Content-Type": "text/plain; charset=utf-8",
    "Content-SHA256": computeContentHash(content),
  };

  if (currentEtag !== null) {
    headers["If-Match"] = currentEtag;
  } else {
    headers["If-Match"] = "*";
  }

  const body = content;

  return executeRequest(url, { method: "PUT", headers, body }, timeoutMs, "instructions");
}

// ---------------------------------------------------------------------------
// Public API: Version history
// ---------------------------------------------------------------------------

/** Result type for history fetch -- extends FetchResult with a success variant */
export type HistoryFetchResult =
  | { readonly kind: "success"; readonly page: HistoryPage }
  | FetchResult;

/**
 * Retrieves paginated version history of the user's instructions.
 * Used by `claude instructions sync history`.
 */
export async function fetchHistory(
  authToken: string,
  cursor: string | null,
  limit: number,
  options: Partial<CloudConfigOptions> = {},
): Promise<HistoryFetchResult> {
  const baseUrl = options.apiBaseUrl ?? DEFAULT_CLOUD_CONFIG_OPTIONS.apiBaseUrl;
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor !== null) {
    const asNumber = parseInt(cursor, 10);
    if (!Number.isNaN(asNumber)) {
      params.set("before_version", String(asNumber));
    } else {
      params.set("cursor", cursor);
    }
  }
  const url = `${baseUrl}${HISTORY_PATH}?${params.toString()}`;
  const headers = buildCommonHeaders(authToken);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLI_OPERATION_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    const nonSuccessResult = await mapNonSuccessResponse(response);
    if (nonSuccessResult !== null) {
      return nonSuccessResult;
    }

    return parseHistoryResponse(response);
  } catch (err: unknown) {
    return mapFetchError(err);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retrieves the content of a specific historical version.
 * Used by `claude instructions sync restore {version}`.
 */
export async function fetchVersion(
  authToken: string,
  version: ContentVersion,
  options: Partial<CloudConfigOptions> = {},
): Promise<FetchResult> {
  const baseUrl = options.apiBaseUrl ?? DEFAULT_CLOUD_CONFIG_OPTIONS.apiBaseUrl;
  const url = `${baseUrl}${VERSION_PATH}/${version}`;

  const headers = {
    ...buildCommonHeaders(authToken),
    Accept: "text/plain, application/json",
  };

  return executeRequest(
    url,
    { method: "GET", headers },
    CLI_OPERATION_TIMEOUT_MS,
    "version",
  );
}

// ---------------------------------------------------------------------------
// Public API: Content hash utilities
// ---------------------------------------------------------------------------

/**
 * Compares a local content hash against a remote metadata response to
 * determine whether a full fetch is needed.
 *
 * Returns true if the hashes differ (content has changed remotely).
 */
export function hasContentChanged(
  localHash: ContentHash,
  remoteHash: ContentHash,
): boolean {
  return localHash !== remoteHash;
}

/**
 * Computes the SHA-256 content hash for a given string.
 * Delegates to the cache module to maintain a single implementation.
 */
export function hashContent(content: string): ContentHash {
  return computeContentHash(content);
}

// ---------------------------------------------------------------------------
// Request execution
// ---------------------------------------------------------------------------

/**
 * Executes an HTTP request with an AbortController timeout and maps the
 * response to a FetchResult discriminated union.
 *
 * Design: No retry logic. The cloud config system is designed to fail fast
 * and retry on the next session start. This keeps the implementation simple
 * and avoids compounding latency during startup.
 */
async function executeRequest(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  kind: RequestKind,
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    return await mapResponse(response, kind);
  } catch (err: unknown) {
    return mapFetchError(err);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Response mapping
// ---------------------------------------------------------------------------

/**
 * Maps an HTTP Response to the appropriate FetchResult variant based on
 * status code.
 */
async function mapResponse(
  response: Response,
  kind: RequestKind,
): Promise<FetchResult> {
  const nonSuccess = await mapNonSuccessResponse(response);
  if (nonSuccess !== null) {
    return nonSuccess;
  }

  if (response.status === 200 || response.status === 201) {
    return parseSuccessResponse(response, kind);
  }

  // Unexpected 2xx/3xx status codes treated as server errors
  const text = await safeReadText(response);
  return {
    kind: "server-error",
    status: response.status,
    message: `Unexpected status ${response.status}: ${text}`,
  };
}

/**
 * Checks for non-success status codes and returns the appropriate
 * FetchResult variant. Returns null for 200 and other success codes
 * that need body parsing.
 */
async function mapNonSuccessResponse(response: Response): Promise<FetchResult | null> {
  const status = response.status;

  if (status === 304) {
    return { kind: "not-modified" };
  }

  if (status === 404) {
    return { kind: "not-found" };
  }

  if (status === 401 || status === 403) {
    return { kind: "auth-error", status };
  }

  if (status === 409) {
    const body = await safeParseJson(response);
    const serverVersion = extractServerVersion(body);
    return { kind: "conflict", serverVersion };
  }

  if (status === 412) {
    const body = await safeParseJson(response);
    const serverVersion = extractServerVersion(body);
    return { kind: "conflict", serverVersion };
  }

  if (status === 429) {
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds =
      retryAfterHeader !== null ? parseInt(retryAfterHeader, 10) : null;
    return {
      kind: "rate-limited",
      retryAfterSeconds:
        retryAfterSeconds !== null && !Number.isNaN(retryAfterSeconds)
          ? retryAfterSeconds
          : null,
    };
  }

  if (status >= 500) {
    const text = await safeReadText(response);
    return { kind: "server-error", status, message: text };
  }

  // Let the caller handle success codes
  return null;
}

/**
 * Parses a 200 response body and extracts/computes all required fields.
 * Falls back gracefully if the response shape is unexpected.
 */
async function parseSuccessResponse(
  response: Response,
  kind: RequestKind,
): Promise<FetchResult> {
  switch (kind) {
    case "metadata":
      return parseMetadataSuccessResponse(response);
    case "instructions":
    case "version":
      return parseInstructionsSuccessResponse(response);
  }
}

async function parseInstructionsSuccessResponse(
  response: Response,
): Promise<FetchResult> {
  const rawBody = await safeReadText(response);
  const parsedBody = parseJsonFromText(rawBody);
  const record =
    parsedBody !== null && typeof parsedBody === "object"
      ? (parsedBody as Record<string, unknown>)
      : null;

  const content = getString(record, ["content"], rawBody);

  const version = toContentVersion(
    getNumber(
      record,
      ["version"],
      getHeaderNumber(response, ["x-instructions-version"], 0),
    ),
  );
  const updatedAt = getString(
    record,
    ["updatedAt", "updated_at"],
    getHeaderString(response, ["x-instructions-updated-at"], ""),
  );
  const updatedBy = getString(
    record,
    ["updatedBy", "updated_by_client_id"],
    getHeaderString(response, ["x-instructions-updated-by"], "unknown"),
  );

  const etag = toETag(
    getHeaderString(response, ["etag"], getString(record, ["etag"], "")),
  );

  const hash = getString(record, ["contentHash", "content_hash"], "");
  const contentHash = toContentHash(
    hash !== ""
      ? hash
      : getHeaderString(response, ["content-sha256", "x-instructions-content-hash"], computeContentHash(content)),
  );

  const data: InstructionsResponse = {
    content,
    version,
    contentHash,
    etag,
    updatedAt,
    updatedBy,
  };
  return { kind: "success", data };
}

async function parseMetadataSuccessResponse(
  response: Response,
): Promise<FetchResult> {
  const body = await safeParseJson(response);
  if (body === null || typeof body !== "object") {
    return {
      kind: "server-error",
      status: response.status,
      message: "Metadata response body is not valid JSON",
    };
  }
  const record = body as Record<string, unknown>;

  const version = toContentVersion(
    getNumber(record, ["version"], 0),
  );
  const contentHash = toContentHash(
    getString(record, ["contentHash", "content_hash"], ""),
  );
  const etag = toETag(getString(record, ["etag"], ""));
  const updatedAt = getString(record, ["updatedAt", "updated_at"], "");
  const updatedBy = getString(record, ["updatedBy", "updated_by_client_id"], "unknown");
  const contentLength = getNumber(record, ["contentLength", "contentLengthBytes", "content_size_bytes"], 0);

  const data: InstructionsResponse = {
    content: "",
    version,
    contentHash,
    etag,
    updatedAt,
    updatedBy,
  };

  if (contentLength >= 0) {
    // no-op: validate numeric conversion for metadata hot path.
  }
  return { kind: "success", data };
}

/**
 * Parses a history response body into a typed HistoryPage.
 */
async function parseHistoryResponse(
  response: Response,
): Promise<HistoryFetchResult> {
  const body = await safeParseJson(response);
  if (body === null || typeof body !== "object") {
    return {
      kind: "server-error",
      status: response.status,
      message: "History response body is not valid JSON",
    };
  }

  const record = body as Record<string, unknown>;
  const rawVersions = Array.isArray(record["versions"]) ? record["versions"] : [];

  const versions: HistoryEntry[] = rawVersions.map((item: unknown) => {
    const v = (item !== null && typeof item === "object")
      ? item as Record<string, unknown>
      : {} as Record<string, unknown>;

    return {
      version: toContentVersion(typeof v["version"] === "number" ? v["version"] : 0),
      updatedAt: getString(v, ["updatedAt", "updated_at"], ""),
      updatedBy: getString(v, ["updatedBy", "updated_by_client_id"], ""),
      contentLength: getNumber(v, ["contentLength", "content_size_bytes"], 0),
      contentHash: toContentHash(getString(v, ["contentHash", "content_hash"], "")),
    };
  });

  return {
    kind: "success",
    page: {
      versions,
      hasMore:
        typeof record["hasMore"] === "boolean"
          ? record["hasMore"]
          : typeof record["has_more"] === "boolean"
            ? (record["has_more"] as boolean)
            : false,
      nextCursor: getCursorValue(record["nextCursor"] ?? record["next_cursor"]),
    },
  };
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

/**
 * Maps a caught fetch error to the appropriate FetchResult variant.
 */
function mapFetchError(err: unknown): FetchResult {
  if (isAbortError(err)) {
    return { kind: "timeout" };
  }
  if (err instanceof ResponseTooLargeError) {
    return { kind: "server-error", status: 200, message: err.message };
  }
  return { kind: "network-error", error: err };
}

// ---------------------------------------------------------------------------
// Header construction
// ---------------------------------------------------------------------------

function buildCommonHeaders(authToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${authToken}`,
    Accept: "application/json",
    "Anthropic-Version": "2026-02-01",
    "User-Agent": USER_AGENT,
  };
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

/**
 * Parses response body as JSON with the same size limit as safeReadText.
 * Returns null on failure instead of throwing, because we handle parse
 * failures as degraded results, not exceptions.
 */
async function safeParseJson(response: Response): Promise<unknown> {
  try {
    const text = await safeReadText(response);
    if (text.length === 0) {
      return null;
    }
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** Thrown when a response body exceeds the size limit. */
class ResponseTooLargeError extends Error {
  constructor(bytes: number, limit: number) {
    super(`Response body too large: ${bytes} bytes exceeds ${limit} byte limit`);
    this.name = "ResponseTooLargeError";
  }
}

/**
 * Reads response body as text with a size limit to prevent memory exhaustion
 * from oversized or malicious responses. Checks Content-Length first for an
 * early reject, then streams the body with a cumulative byte cap.
 *
 * Throws ResponseTooLargeError on oversize — callers must handle this as an
 * error, not silently degrade to empty content.
 */
async function safeReadText(
  response: Response,
  maxBytes: number = MAX_RESPONSE_BODY_BYTES,
): Promise<string> {
  // Fast-path: reject immediately if Content-Length exceeds the limit
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declared = parseInt(contentLength, 10);
    if (!Number.isNaN(declared) && declared > maxBytes) {
      try { response.body?.cancel(); } catch { /* best-effort cleanup */ }
      throw new ResponseTooLargeError(declared, maxBytes);
    }
  }

  // For chunked / unknown-length responses, read incrementally
  if (response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    let totalBytes = 0;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          throw new ResponseTooLargeError(totalBytes, maxBytes);
        }
        chunks.push(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if (err instanceof ResponseTooLargeError) throw err;
      throw new Error(`Failed to read response body: ${describeReadError(err)}`);
    }

    // Flush the decoder
    chunks.push(decoder.decode());
    return chunks.join("");
  }

  // Fallback for environments without ReadableStream body
  const text = await response.text();
  if (Buffer.byteLength(text, "utf-8") > maxBytes) {
    throw new ResponseTooLargeError(Buffer.byteLength(text, "utf-8"), maxBytes);
  }
  return text;
}

function describeReadError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function parseJsonFromText(text: string): unknown | null {
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getString(
  record: Record<string, unknown> | null,
  keys: ReadonlyArray<string>,
  fallback: string,
): string {
  if (record !== null) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string") {
        return value;
      }
    }
  }
  return fallback;
}

function getNumber(
  record: Record<string, unknown> | null,
  keys: ReadonlyArray<string>,
  fallback: number,
): number {
  if (record !== null) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "number") {
        return value;
      }
      if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }
  }
  return fallback;
}

function getHeaderString(
  response: Response,
  headerNames: ReadonlyArray<string>,
  fallback: string,
): string {
  for (const headerName of headerNames) {
    const value = response.headers.get(headerName);
    if (value !== null) {
      return value;
    }
  }
  return fallback;
}

function getHeaderNumber(
  response: Response,
  headerNames: ReadonlyArray<string>,
  fallback: number,
): number {
  const value = getHeaderString(response, headerNames, "");
  if (value === "") {
    return fallback;
  }
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function getCursorValue(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

/**
 * Extracts a server version from a conflict (409) response body.
 * The server may include the current version so the client knows
 * what it is competing against.
 */
function extractServerVersion(body: unknown): ContentVersion {
  if (body !== null && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record["current_version"] === "number") {
      return toContentVersion(record["current_version"]);
    }
    if (typeof record["version"] === "number") {
      return toContentVersion(record["version"]);
    }
  }
  return toContentVersion(0);
}

/**
 * Type guard for AbortError, which is thrown when an AbortController
 * cancels a fetch. Covers both the standard DOMException name and the
 * Node.js AbortError.
 */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") {
    return true;
  }
  if (err instanceof Error && err.name === "AbortError") {
    return true;
  }
  return false;
}
