import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { githubRequest, paginateAll, getRepoConfig } from "./github-api";

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.GITHUB_TOKEN = "test-token";
  process.env.GITHUB_REPOSITORY_OWNER = "testorg";
  process.env.GITHUB_REPOSITORY_NAME = "testrepo";
});

afterEach(() => {
  global.fetch = originalFetch;
});

// --

describe("githubRequest", () => {
  test("throws when GITHUB_TOKEN missing", async () => {
    delete process.env.GITHUB_TOKEN;
    await expect(githubRequest("/repos/test")).rejects.toThrow("GITHUB_TOKEN required");
  });

  test("GET request sends correct headers", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    );
    global.fetch = fetchMock as typeof fetch;

    await githubRequest("/test");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/test");
    expect((init as RequestInit).method).toBe("GET");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-token");
    expect(headers["Accept"]).toBe("application/vnd.github.v3+json");
  });

  test("throws on non-ok response", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response("Not Found", { status: 404, statusText: "Not Found" }))
    ) as typeof fetch;

    await expect(githubRequest("/test")).rejects.toThrow("GitHub API 404");
  });

  test("POST request serializes body and sets Content-Type", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    );
    global.fetch = fetchMock as typeof fetch;

    await githubRequest("/test", "POST", { key: "value" });

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ key: "value" });
  });

  test("GET request sends no body and no Content-Type", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    );
    global.fetch = fetchMock as typeof fetch;

    await githubRequest("/test");

    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect((init as RequestInit).body).toBeUndefined();
  });

  test("returns parsed response data", async () => {
    global.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ id: 42 }), { status: 200 }))
    ) as typeof fetch;
    const result = await githubRequest<{ id: number }>("/test");
    expect(result).toEqual({ id: 42 });
  });

  test("sends User-Agent header", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    );
    global.fetch = fetchMock as typeof fetch;
    await githubRequest("/test");
    const [, init] = fetchMock.mock.calls[0];
    expect(((init as RequestInit).headers as Record<string, string>)["User-Agent"]).toBe(
      "claude-code-scripts"
    );
  });

  test("propagates network error when fetch throws", async () => {
    global.fetch = mock(() => Promise.reject(new Error("network failure"))) as typeof fetch;
    await expect(githubRequest("/test")).rejects.toThrow("network failure");
  });

  test("PATCH request sends method and body correctly", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
    );
    global.fetch = fetchMock as typeof fetch;
    await githubRequest("/test", "PATCH", { state: "closed" });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ state: "closed" });
  });

  test("throws on 500 with status in message", async () => {
    global.fetch = mock(() =>
      Promise.resolve(
        new Response("Internal Server Error", { status: 500, statusText: "Internal Server Error" })
      )
    ) as typeof fetch;
    await expect(githubRequest("/test")).rejects.toThrow("GitHub API 500");
  });
});

// --

describe("paginateAll", () => {
  test("collects items across pages until empty page", async () => {
    let call = 0;
    const fetchMock = mock(() => {
      call++;
      const data = call <= 2 ? [{ id: call }] : [];
      return Promise.resolve(new Response(JSON.stringify(data), { status: 200 }));
    });
    global.fetch = fetchMock as typeof fetch;

    const result = await paginateAll<{ id: number }>("/repos/test/issues?state=open");
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(call).toBe(3);
  });

  test("stops at maxPages even if pages are non-empty", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }))
    );
    global.fetch = fetchMock as typeof fetch;

    const result = await paginateAll<{ id: number }>("/test", 3);
    expect(result).toHaveLength(3);
    expect(fetchMock.mock.calls).toHaveLength(3);
  });

  test("appends per_page and page to endpoint without existing query", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    );
    global.fetch = fetchMock as typeof fetch;

    await paginateAll("/repos/test/issues");
    const [url] = fetchMock.mock.calls[0];
    expect(url as string).toContain("?per_page=100&page=1");
  });

  test("appends per_page and page to endpoint with existing query", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    );
    global.fetch = fetchMock as typeof fetch;

    await paginateAll("/repos/test/issues?state=open");
    const [url] = fetchMock.mock.calls[0];
    expect(url as string).toContain("&per_page=100&page=1");
  });

  test("returns empty array when first page is empty", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(new Response(JSON.stringify([]), { status: 200 }))
    );
    global.fetch = fetchMock as typeof fetch;
    const result = await paginateAll("/test");
    expect(result).toEqual([]);
    expect(fetchMock.mock.calls).toHaveLength(1);
  });

  test("stops when response is not an array", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ message: "unexpected" }), { status: 200 })
      )
    );
    global.fetch = fetchMock as typeof fetch;
    const result = await paginateAll("/test");
    expect(result).toEqual([]);
    expect(fetchMock.mock.calls).toHaveLength(1);
  });

  test("propagates error from githubRequest on subsequent pages", async () => {
    let call = 0;
    global.fetch = mock(() => {
      call++;
      if (call === 1)
        return Promise.resolve(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }));
      return Promise.resolve(
        new Response("Rate limited", { status: 429, statusText: "Too Many Requests" })
      );
    }) as typeof fetch;
    await expect(paginateAll("/test")).rejects.toThrow("GitHub API 429");
  });
});

// --

describe("getRepoConfig", () => {
  test("reads owner and repo from env", () => {
    expect(getRepoConfig()).toEqual({ owner: "testorg", repo: "testrepo" });
  });

  test("falls back to anthropics/claude-code when env vars missing", () => {
    delete process.env.GITHUB_REPOSITORY_OWNER;
    delete process.env.GITHUB_REPOSITORY_NAME;
    expect(getRepoConfig()).toEqual({ owner: "anthropics", repo: "claude-code" });
  });

  test("falls back owner only", () => {
    delete process.env.GITHUB_REPOSITORY_OWNER;
    expect(getRepoConfig()).toEqual({ owner: "anthropics", repo: "testrepo" });
  });

  test("empty string env vars are not replaced (?? vs ||)", () => {
    process.env.GITHUB_REPOSITORY_OWNER = "";
    process.env.GITHUB_REPOSITORY_NAME = "";
    expect(getRepoConfig()).toEqual({ owner: "", repo: "" });
  });
});
