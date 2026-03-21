import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { githubRequest } from "./github-request.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Response-like object for the mock. */
function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function textResponse(body: string, status: number, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

function networkError(code: string, message = "Connection failed"): Error {
  const err = new Error(message) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof mock>;

beforeEach(() => {
  fetchMock = mock(() => Promise.resolve(jsonResponse({ ok: true })));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("githubRequest", () => {
  // ── Basic functionality ───────────────────────────────────────────────

  test("makes GET request by default", async () => {
    const result = await githubRequest("/repos/test/repo", "test-token");
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.github.com/repos/test/repo");
    expect(opts.method).toBe("GET");
    expect((opts.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-token");
  });

  test("sends POST with JSON body", async () => {
    await githubRequest("/repos/test/repo/issues", "token", {
      method: "POST",
      body: { title: "test" },
    });

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({ title: "test" });
    expect((opts.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  test("handles 204 No Content", async () => {
    fetchMock = mock(() => Promise.resolve(new Response(null, { status: 204 })));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo/labels", "token", {
      method: "POST",
      body: { labels: ["bug"] },
    });
    expect(result).toEqual({});
  });

  // ── Error handling ────────────────────────────────────────────────────

  test("throws on non-retryable HTTP error (422)", async () => {
    fetchMock = mock(() =>
      Promise.resolve(textResponse("Validation failed", 422)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      githubRequest("/repos/test/repo", "token"),
    ).rejects.toThrow("GitHub API 422");

    expect(fetchMock).toHaveBeenCalledTimes(1); // no retries
  });

  test("throws on 401 Unauthorized without retry", async () => {
    fetchMock = mock(() =>
      Promise.resolve(textResponse("Bad credentials", 401)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      githubRequest("/repos/test/repo", "token"),
    ).rejects.toThrow("GitHub API 401");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("throws on 403 Forbidden without retry", async () => {
    fetchMock = mock(() =>
      Promise.resolve(textResponse("Forbidden", 403)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      githubRequest("/repos/test/repo", "token"),
    ).rejects.toThrow("GitHub API 403");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ── Retry on transient network errors ─────────────────────────────────

  test("retries on ECONNRESET", async () => {
    let callCount = 0;
    fetchMock = mock(() => {
      callCount++;
      if (callCount <= 2) return Promise.reject(networkError("ECONNRESET"));
      return Promise.resolve(jsonResponse({ recovered: true }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      maxRetries: 3,
    });

    expect(result).toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(3); // 2 failures + 1 success
  });

  test("retries on EPIPE", async () => {
    let callCount = 0;
    fetchMock = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(networkError("EPIPE"));
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      maxRetries: 2,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("retries on ETIMEDOUT", async () => {
    let callCount = 0;
    fetchMock = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(networkError("ETIMEDOUT"));
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      maxRetries: 2,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("retries on ECONNREFUSED", async () => {
    let callCount = 0;
    fetchMock = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(networkError("ECONNREFUSED"));
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      maxRetries: 2,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("retries on Bun socket close message", async () => {
    let callCount = 0;
    fetchMock = mock(() => {
      callCount++;
      if (callCount === 1)
        return Promise.reject(
          new Error("The socket connection was closed unexpectedly"),
        );
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      maxRetries: 2,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("exhausts retries and throws on persistent ECONNRESET", async () => {
    fetchMock = mock(() => Promise.reject(networkError("ECONNRESET")));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      githubRequest("/repos/test/repo", "token", { maxRetries: 2 }),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  test("does not retry non-transient errors", async () => {
    fetchMock = mock(() =>
      Promise.reject(new Error("Something unexpected")),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      githubRequest("/repos/test/repo", "token", { maxRetries: 3 }),
    ).rejects.toThrow("Something unexpected");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ── Retry on retryable HTTP status codes ──────────────────────────────

  test("retries on 502 Bad Gateway", async () => {
    let callCount = 0;
    fetchMock = mock(() => {
      callCount++;
      if (callCount === 1)
        return Promise.resolve(textResponse("Bad Gateway", 502));
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      maxRetries: 2,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("retries on 500 Internal Server Error", async () => {
    let callCount = 0;
    fetchMock = mock(() => {
      callCount++;
      if (callCount === 1)
        return Promise.resolve(textResponse("Internal Server Error", 500));
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      maxRetries: 2,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("retries on 503 Service Unavailable", async () => {
    let callCount = 0;
    fetchMock = mock(() => {
      callCount++;
      if (callCount === 1)
        return Promise.resolve(textResponse("Unavailable", 503));
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      maxRetries: 2,
    });
    expect(result).toEqual({ ok: true });
  });

  test("retries on 429 rate limit", async () => {
    let callCount = 0;
    fetchMock = mock(() => {
      callCount++;
      if (callCount === 1)
        return Promise.resolve(
          textResponse("Rate limited", 429, { "retry-after": "1" }),
        );
      return Promise.resolve(jsonResponse({ ok: true }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      maxRetries: 2,
    });
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("exhausts retries on persistent 502", async () => {
    fetchMock = mock(() =>
      Promise.resolve(textResponse("Bad Gateway", 502)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      githubRequest("/repos/test/repo", "token", { maxRetries: 2 }),
    ).rejects.toThrow("GitHub API 502");

    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  // ── maxRetries=0 disables retry ───────────────────────────────────────

  test("maxRetries=0 disables retry for network errors", async () => {
    fetchMock = mock(() => Promise.reject(networkError("ECONNRESET")));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      githubRequest("/repos/test/repo", "token", { maxRetries: 0 }),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("maxRetries=0 disables retry for HTTP errors", async () => {
    fetchMock = mock(() =>
      Promise.resolve(textResponse("Bad Gateway", 502)),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      githubRequest("/repos/test/repo", "token", { maxRetries: 0 }),
    ).rejects.toThrow("GitHub API 502");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ── Mixed error scenarios ─────────────────────────────────────────────

  test("retries through mixed ECONNRESET then 502 then success", async () => {
    let callCount = 0;
    fetchMock = mock(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(networkError("ECONNRESET"));
      if (callCount === 2)
        return Promise.resolve(textResponse("Bad Gateway", 502));
      return Promise.resolve(jsonResponse({ finally: "success" }));
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      maxRetries: 3,
    });
    expect(result).toEqual({ finally: "success" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  // ── Timeout ───────────────────────────────────────────────────────────

  test("aborts on timeout and retries", async () => {
    let callCount = 0;
    fetchMock = mock((_url: string, opts: RequestInit) => {
      callCount++;
      if (callCount === 1) {
        // Simulate a slow response — the AbortSignal should fire before this resolves
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
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await githubRequest("/repos/test/repo", "token", {
      timeoutMs: 50, // very short timeout to trigger abort
      maxRetries: 2,
    });

    expect(result).toEqual({ fast: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // ── Custom User-Agent ─────────────────────────────────────────────────

  test("uses custom userAgent", async () => {
    await githubRequest("/repos/test/repo", "token", {
      userAgent: "my-script",
    });

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)["User-Agent"]).toBe("my-script");
  });

  test("uses default userAgent when not specified", async () => {
    await githubRequest("/repos/test/repo", "token");

    const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)["User-Agent"]).toBe("claude-code-scripts");
  });
});
