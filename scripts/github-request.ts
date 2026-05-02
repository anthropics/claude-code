/**
 * Shared GitHub API request utility with retry, timeout, and rate-limit handling.
 *
 * All scripts in this directory make unauthenticated or token-authenticated
 * calls to the GitHub REST API.  Transient failures (ECONNRESET, 502, 429, …)
 * are common in CI and long-running batch jobs.  This module wraps `fetch()`
 * with exponential-backoff retry so every caller gets resilience for free.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubRequestOptions {
  /** HTTP method (default: GET) */
  method?: string;
  /** JSON body — will be serialised automatically */
  body?: unknown;
  /** Per-request timeout in ms (default: 30 000) */
  timeoutMs?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Custom User-Agent header (default: "claude-code-scripts") */
  userAgent?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 32_000;

/** Error codes that are safe to retry — the request never reached the server
 *  or was interrupted mid-flight by a network event. */
const TRANSIENT_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

/** HTTP status codes that are safe to retry. */
const RETRYABLE_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests (rate-limited)
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

// ---------------------------------------------------------------------------
// Helpers (exported for testing)
// ---------------------------------------------------------------------------

export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const code = (error as NodeJS.ErrnoException).code ?? "";
  if (TRANSIENT_ERROR_CODES.has(code)) return true;

  // Bun-specific socket close message
  if (error.message.includes("socket connection was closed unexpectedly"))
    return true;

  // AbortError from our own timeout — safe to retry
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;

  return false;
}

export function calculateDelay(attempt: number): number {
  const base = Math.min(
    INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt),
    MAX_RETRY_DELAY_MS,
  );
  // Add ±25 % jitter to avoid thundering herd
  const jitter = base * (0.75 + Math.random() * 0.5);
  return Math.round(jitter);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse the `Retry-After` header (seconds or HTTP-date) into milliseconds.
 * Returns `null` when the header is missing or un-parseable.
 */
export function parseRetryAfter(headers: Headers): number | null {
  const value = headers.get("retry-after");
  if (!value) return null;

  // Numeric seconds
  const seconds = Number(value);
  if (!Number.isNaN(seconds) && seconds > 0 && seconds <= 300) {
    return seconds * 1000;
  }

  // HTTP-date
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    const ms = date - Date.now();
    return ms > 0 && ms <= 300_000 ? ms : null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Make a GitHub REST API request with automatic retry on transient failures.
 *
 * @param endpoint  Path starting with `/` — appended to `https://api.github.com`.
 * @param token     GitHub personal-access or installation token.
 * @param options   Optional overrides for method, body, timeout, retries, etc.
 * @returns         Parsed JSON response body (typed as `T`).
 * @throws          After all retries are exhausted, or on non-retryable errors.
 */
export async function githubRequest<T>(
  endpoint: string,
  token: string,
  options: GitHubRequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    userAgent = "claude-code-scripts",
  } = options;

  const url = `https://api.github.com${endpoint}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": userAgent,
          ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });

      // ── Non-retryable success or client error ─────────────────────
      if (response.ok) {
        if (response.status === 204) {
          return {} as T;
        }
        return (await response.json()) as T;
      }

      // ── Retryable HTTP status ─────────────────────────────────────
      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxRetries) {
        const retryAfter = parseRetryAfter(response.headers);
        const delay = retryAfter ?? calculateDelay(attempt);
        const text = await response.text().catch(() => "");
        console.warn(
          `[RETRY] GitHub API ${response.status} on ${method} ${endpoint} — ` +
            `retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})` +
            (text ? `: ${text.slice(0, 200)}` : ""),
        );
        await sleep(delay);
        continue;
      }

      // ── Non-retryable HTTP error ──────────────────────────────────
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`GitHub API ${response.status}: ${text}`);
    } catch (error: unknown) {
      // ── Retryable network / timeout error ─────────────────────────
      if (isTransientError(error) && attempt < maxRetries) {
        const delay = calculateDelay(attempt);
        const code =
          (error as NodeJS.ErrnoException).code ?? (error as Error).name;
        console.warn(
          `[RETRY] ${code} on ${method} ${endpoint} — ` +
            `retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})`,
        );
        await sleep(delay);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // Should never reach here, but satisfy TypeScript
  throw new Error(`GitHub API request failed after ${maxRetries} retries`);
}
