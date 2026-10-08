import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  githubRequest,
  isTransientError,
  calculateDelay,
  parseRetryAfter,
} from "./github-request.ts";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function textResponse(
  body: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, { status, headers });
}

function networkError(code: string, message = "Connection failed"): Error {
  const err = new Error(message) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// Unit tests — internal helpers
// ---------------------------------------------------------------------------

describe("isTransientError", () => {
  test.each([
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
  ])("returns true for %s", (code) => {
    expect(isTransientError(networkError(code))).toBe(true);
  });

  test("returns true for Bun socket close message", () => {
    expect(
      isTransientError(
        new Error("The socket connection was closed unexpectedly"),
      ),
    ).toBe(true);
  });

  test("returns true for AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(isTransientError(err)).toBe(true);
  });

  test("returns true for TimeoutError", () => {
    const err = new Error("timed out");
    err.name = "TimeoutError";
    expect(isTransientError(err)).toBe(true);
  });

  test("returns false for generic Error", () => {
    expect(isTransientError(new Error("Something unexpected"))).toBe(false);
  });

  test("returns false for non-Error values", () => {
    expect(isTransientError("string error")).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError(42)).toBe(false);
  });
});

describe("calculateDelay", () => {
  test("returns a value in the jitter range for attempt 0", () => {
    const delay = calculateDelay(0);
    // base = 500ms, jitter range = [375, 625]
    expect(delay).toBeGreaterThanOrEqual(375);
    expect(delay).toBeLessThanOrEqual(625);
  });

  test("increases exponentially", () => {
    // attempt 0 base = 500, attempt 3 base = 4000
    // Collect several samples to verify the trend
    const lowSamples = Array.from({ length: 10 }, () => calculateDelay(0));
    const highSamples = Array.from({ length: 10 }, () => calculateDelay(3));
    const lowAvg = lowSamples.reduce((a, b) => a + b, 0) / lowSamples.length;
    const highAvg =
      highSamples.reduce((a, b) => a + b, 0) / highSamples.length;
    expect(highAvg).toBeGreaterThan(lowAvg * 3);
  });

  test("caps at MAX_RETRY_DELAY_MS (32s)", () => {
    const delay = calculateDelay(20); // 500 * 2^20 would be huge without cap
    // max base = 32000, jitter range = [24000, 40000]
    expect(delay).toBeLessThanOrEqual(40_000);
  });
});

describe("parseRetryAfter", () => {
  test("parses numeric seconds", () => {
    const headers = new Headers({ "retry-after": "5" });
    expect(parseRetryAfter(headers)).toBe(5000);
  });

  test("returns null for missing header", () => {
    expect(parseRetryAfter(new Headers())).toBeNull();
  });

  test("returns null for zero", () => {
    const headers = new Headers({ "retry-after": "0" });
    expect(parseRetryAfter(headers)).toBeNull();
  });

  test("returns null for negative values", () => {
    const headers = new Headers({ "retry-after": "-10" });
    expect(parseRetryAfter(headers)).toBeNull();
  });

  test("caps at 300 seconds", () => {
    const headers = new Headers({ "retry-after": "301" });
    expect(parseRetryAfter(headers)).toBeNull();
  });

  test("accepts values up to 300 seconds", () => {
    const headers = new Headers({ "retry-after": "300" });
    expect(parseRetryAfter(headers)).toBe(300_000);
  });

  test("returns null for unparseable value", () => {
    const headers = new Headers({ "retry-after": "not-a-number" });
    expect(parseRetryAfter(headers)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Integration tests — githubRequest
// ---------------------------------------------------------------------------

describe("githubRequest", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof mock>;

  /** Replace `globalThis.fetch` with a fresh mock before each test. */
  function mockFetch(
    impl: (...args: unknown[]) => Promise<Response>,
  ): void {
    fetchMock = mock(impl);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  }

  beforeEach(() => {
    mockFetch(() => Promise.resolve(jsonResponse({ ok: true })));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Basic request functionality ───────────────────────────────────────

  describe("basic requests", () => {
    test("makes GET request with auth header", async () => {
      const result = await githubRequest("/repos/test/repo", "test-token");
      expect(result).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://api.github.com/repos/test/repo");
      expect(opts.method).toBe("GET");
      expect((opts.headers as Record<string, string>)["Authorization"]).toBe(
        "Bearer test-token",
      );
    });

    test("sends POST with JSON body and Content-Type", async () => {
      await githubRequest("/repos/test/repo/issues", "token", {
        method: "POST",
        body: { title: "test" },
      });

      const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body as string)).toEqual({ title: "test" });
      expect((opts.headers as Record<string, string>)["Content-Type"]).toBe(
        "application/json",
      );
    });

    test("handles 204 No Content without crashing on json()", async () => {
      mockFetch(() =>
        Promise.resolve(new Response(null, { status: 204 })),
      );
      const result = await githubRequest("/repos/test/repo/labels", "token", {
        method: "POST",
        body: { labels: ["bug"] },
      });
      expect(result).toEqual({});
    });

    test("uses custom userAgent", async () => {
      await githubRequest("/repos/test/repo", "token", {
        userAgent: "my-script",
      });
      const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((opts.headers as Record<string, string>)["User-Agent"]).toBe(
        "my-script",
      );
    });

    test("uses default userAgent when not specified", async () => {
      await githubRequest("/repos/test/repo", "token");
      const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((opts.headers as Record<string, string>)["User-Agent"]).toBe(
        "claude-code-scripts",
      );
    });
  });

  // ── Non-retryable errors ──────────────────────────────────────────────

  describe("non-retryable HTTP errors", () => {
    test.each([
      [401, "Bad credentials"],
      [403, "Forbidden"],
      [422, "Validation failed"],
    ])("throws immediately on %i without retry", async (status, body) => {
      mockFetch(() => Promise.resolve(textResponse(body, status)));
      await expect(
        githubRequest("/repos/test/repo", "token"),
      ).rejects.toThrow(`GitHub API ${status}`);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("does not retry non-transient network errors", async () => {
      mockFetch(() =>
        Promise.reject(new Error("Something unexpected")),
      );
      await expect(
        githubRequest("/repos/test/repo", "token", { maxRetries: 3 }),
      ).rejects.toThrow("Something unexpected");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── Retry on transient network errors ─────────────────────────────────

  describe("retry on transient network errors", () => {
    /**
     * Helper: fetch fails `failCount` times with the given error, then succeeds.
     */
    function failThenSucceed(
      makeError: () => Error,
      failCount: number,
    ): void {
      let calls = 0;
      mockFetch(() => {
        calls++;
        if (calls <= failCount) return Promise.reject(makeError());
        return Promise.resolve(jsonResponse({ recovered: true }));
      });
    }

    test.each(["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED"])(
      "retries and recovers from %s",
      async (code) => {
        failThenSucceed(() => networkError(code), 1);
        const result = await githubRequest("/repos/test/repo", "token", {
          maxRetries: 2,
        });
        expect(result).toEqual({ recovered: true });
        expect(fetchMock).toHaveBeenCalledTimes(2);
      },
    );

    test("retries and recovers from Bun socket close", async () => {
      failThenSucceed(
        () => new Error("The socket connection was closed unexpectedly"),
        1,
      );
      const result = await githubRequest("/repos/test/repo", "token", {
        maxRetries: 2,
      });
      expect(result).toEqual({ recovered: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("recovers after multiple consecutive failures", async () => {
      failThenSucceed(() => networkError("ECONNRESET"), 2);
      const result = await githubRequest("/repos/test/repo", "token", {
        maxRetries: 3,
      });
      expect(result).toEqual({ recovered: true });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test("throws after exhausting all retries", async () => {
      mockFetch(() => Promise.reject(networkError("ECONNRESET")));
      await expect(
        githubRequest("/repos/test/repo", "token", { maxRetries: 2 }),
      ).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
    });
  });

  // ── Retry on retryable HTTP status codes ──────────────────────────────

  describe("retry on retryable HTTP status codes", () => {
    function httpFailThenSucceed(status: number, body: string): void {
      let calls = 0;
      mockFetch(() => {
        calls++;
        if (calls === 1) return Promise.resolve(textResponse(body, status));
        return Promise.resolve(jsonResponse({ ok: true }));
      });
    }

    test.each([
      [429, "Rate limited"],
      [500, "Internal Server Error"],
      [502, "Bad Gateway"],
      [503, "Service Unavailable"],
      [504, "Gateway Timeout"],
    ])("retries and recovers from %i", async (status, body) => {
      httpFailThenSucceed(status, body);
      const result = await githubRequest("/repos/test/repo", "token", {
        maxRetries: 2,
      });
      expect(result).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("respects Retry-After header on 429", async () => {
      let calls = 0;
      mockFetch(() => {
        calls++;
        if (calls === 1)
          return Promise.resolve(
            textResponse("Rate limited", 429, { "retry-after": "1" }),
          );
        return Promise.resolve(jsonResponse({ ok: true }));
      });
      const result = await githubRequest("/repos/test/repo", "token", {
        maxRetries: 2,
      });
      expect(result).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("throws after exhausting retries on persistent 502", async () => {
      mockFetch(() => Promise.resolve(textResponse("Bad Gateway", 502)));
      await expect(
        githubRequest("/repos/test/repo", "token", { maxRetries: 2 }),
      ).rejects.toThrow("GitHub API 502");
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  // ── maxRetries=0 disables retry ───────────────────────────────────────

  describe("maxRetries=0", () => {
    test("no retry on network error", async () => {
      mockFetch(() => Promise.reject(networkError("ECONNRESET")));
      await expect(
        githubRequest("/repos/test/repo", "token", { maxRetries: 0 }),
      ).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("no retry on retryable HTTP status", async () => {
      mockFetch(() => Promise.resolve(textResponse("Bad Gateway", 502)));
      await expect(
        githubRequest("/repos/test/repo", "token", { maxRetries: 0 }),
      ).rejects.toThrow("GitHub API 502");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── Mixed error scenarios ─────────────────────────────────────────────

  describe("mixed error scenarios", () => {
    test("recovers through ECONNRESET → 502 → success", async () => {
      let calls = 0;
      mockFetch(() => {
        calls++;
        if (calls === 1) return Promise.reject(networkError("ECONNRESET"));
        if (calls === 2)
          return Promise.resolve(textResponse("Bad Gateway", 502));
        return Promise.resolve(jsonResponse({ finally: "success" }));
      });
      const result = await githubRequest("/repos/test/repo", "token", {
        maxRetries: 3,
      });
      expect(result).toEqual({ finally: "success" });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  // ── Timeout ───────────────────────────────────────────────────────────

  describe("timeout", () => {
    test("aborts slow requests and retries", async () => {
      let calls = 0;
      mockFetch((_url: unknown, opts: RequestInit) => {
        calls++;
        if (calls === 1) {
          return new Promise<Response>((resolve, reject) => {
            const timer = setTimeout(
              () => resolve(jsonResponse({ slow: true })),
              5000,
            );
            opts.signal?.addEventListener("abort", () => {
              clearTimeout(timer);
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            });
          });
        }
        return Promise.resolve(jsonResponse({ fast: true }));
      });

      const result = await githubRequest("/repos/test/repo", "token", {
        timeoutMs: 50,
        maxRetries: 2,
      });
      expect(result).toEqual({ fast: true });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
