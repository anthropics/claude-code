import { test, expect } from "bun:test";
import {
  buildStaleQuery,
  isStaleCandidate,
  collectPages,
  withRateLimitRetry,
} from "./sweep-lib.ts";

const CUTOFF = new Date("2026-06-25T13:45:00Z");
const THRESHOLD = 10;

// Helper: a minimal issue that IS a stale candidate; tests override one field
// at a time to prove each disqualifier works in isolation.
const candidate = (overrides: Record<string, unknown> = {}) => ({
  number: 1,
  updated_at: "2026-01-01T00:00:00Z",
  locked: false,
  assignees: [],
  labels: [{ name: "bug" }],
  reactions: { "+1": 0 },
  ...overrides,
});

// -- buildStaleQuery ---------------------------------------------------------

test("query targets exactly the labelable set, with a date-only cutoff", () => {
  expect(buildStaleQuery("anthropics", "claude-code", CUTOFF)).toBe(
    "repo:anthropics/claude-code is:issue is:open updated:<2026-06-25 -label:stale -label:autoclose no:assignee"
  );
});

// -- isStaleCandidate --------------------------------------------------------

test("an old, unlabeled, unassigned, quiet issue is a candidate", () => {
  expect(isStaleCandidate(candidate(), CUTOFF, THRESHOLD)).toBe(true);
});

test("pull requests are never candidates", () => {
  expect(
    isStaleCandidate(candidate({ pull_request: { url: "x" } }), CUTOFF, THRESHOLD)
  ).toBe(false);
});

test("locked issues are not candidates", () => {
  expect(isStaleCandidate(candidate({ locked: true }), CUTOFF, THRESHOLD)).toBe(false);
});

test("assigned issues are not candidates", () => {
  expect(
    isStaleCandidate(candidate({ assignees: [{ login: "a" }] }), CUTOFF, THRESHOLD)
  ).toBe(false);
});

test("issues already labeled stale or autoclose are not candidates", () => {
  expect(
    isStaleCandidate(candidate({ labels: [{ name: "stale" }] }), CUTOFF, THRESHOLD)
  ).toBe(false);
  expect(
    isStaleCandidate(candidate({ labels: [{ name: "autoclose" }] }), CUTOFF, THRESHOLD)
  ).toBe(false);
});

test("issues at or above the upvote threshold are not candidates", () => {
  expect(
    isStaleCandidate(candidate({ reactions: { "+1": THRESHOLD } }), CUTOFF, THRESHOLD)
  ).toBe(false);
  expect(
    isStaleCandidate(candidate({ reactions: { "+1": THRESHOLD - 1 } }), CUTOFF, THRESHOLD)
  ).toBe(true);
});

test("issues updated on or after the cutoff are not candidates", () => {
  expect(
    isStaleCandidate(candidate({ updated_at: "2026-07-01T00:00:00Z" }), CUTOFF, THRESHOLD)
  ).toBe(false);
  expect(
    isStaleCandidate(candidate({ updated_at: CUTOFF.toISOString() }), CUTOFF, THRESHOLD)
  ).toBe(false);
});

test("missing optional fields do not disqualify an old issue", () => {
  expect(
    isStaleCandidate({ number: 2, updated_at: "2026-01-01T00:00:00Z" }, CUTOFF, THRESHOLD)
  ).toBe(true);
});

// -- collectPages ------------------------------------------------------------

// Fake paginated backend: `pages` is the full dataset served 100 at a time.
const backend = (all: number[], perPage = 100) => {
  const calls: number[] = [];
  const fetchPage = async (page: number) => {
    calls.push(page);
    return all.slice((page - 1) * perPage, page * perPage);
  };
  return { calls, fetchPage };
};

test("collects every page until a short page, preserving order", async () => {
  const all = Array.from({ length: 250 }, (_, i) => i);
  const { calls, fetchPage } = backend(all);
  const result = await collectPages(fetchPage);
  expect(result).toEqual(all);
  expect(calls).toEqual([1, 2, 3]); // 100, 100, 50 — stops on the short page
});

test("stops on an empty page when the last full page ends the dataset", async () => {
  const all = Array.from({ length: 200 }, (_, i) => i);
  const { calls, fetchPage } = backend(all);
  const result = await collectPages(fetchPage);
  expect(result).toEqual(all);
  expect(calls).toEqual([1, 2, 3]); // page 3 is empty
});

test("a short first page needs exactly one fetch", async () => {
  const { calls, fetchPage } = backend([1, 2, 3]);
  const result = await collectPages(fetchPage);
  expect(result).toEqual([1, 2, 3]);
  expect(calls).toEqual([1]);
});

test("respects the maxPages safety cap", async () => {
  const all = Array.from({ length: 500 }, (_, i) => i);
  const { calls, fetchPage } = backend(all);
  const result = await collectPages(fetchPage, { maxPages: 2 });
  expect(result).toEqual(all.slice(0, 200));
  expect(calls).toEqual([1, 2]);
});

// -- withRateLimitRetry --------------------------------------------------------

// Fake flaky call: fails `n` times with `error`, then returns "ok".
const failNTimes = (n: number, error: string) => {
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls <= n) throw new Error(error);
    return "ok";
  };
  return { fn, calls: () => calls };
};

test("returns the result without sleeping when the call succeeds", async () => {
  const sleeps: number[] = [];
  const { fn, calls } = failNTimes(0, "");
  const result = await withRateLimitRetry(fn, {
    sleeper: async (ms) => void sleeps.push(ms),
  });
  expect(result).toBe("ok");
  expect(calls()).toBe(1);
  expect(sleeps).toEqual([]);
});

test("backs off and retries when GitHub reports a secondary rate limit", async () => {
  const sleeps: number[] = [];
  const { fn, calls } = failNTimes(2, "GitHub API 403: secondary rate limit");
  const result = await withRateLimitRetry(fn, {
    sleeper: async (ms) => void sleeps.push(ms),
  });
  expect(result).toBe("ok");
  expect(calls()).toBe(3);
  expect(sleeps).toEqual([60000, 120000]);
});

test("retries 429 responses too", async () => {
  const { fn, calls } = failNTimes(1, "GitHub API 429: too many requests");
  expect(await withRateLimitRetry(fn, { sleeper: async () => {} })).toBe("ok");
  expect(calls()).toBe(2);
});

test("rethrows non-rate-limit errors immediately", async () => {
  const { fn, calls } = failNTimes(5, "GitHub API 500: boom");
  await expect(withRateLimitRetry(fn, { sleeper: async () => {} })).rejects.toThrow("500");
  expect(calls()).toBe(1);
});

test("gives up after the attempt budget", async () => {
  const { fn, calls } = failNTimes(99, "GitHub API 403: rate limit");
  await expect(
    withRateLimitRetry(fn, { attempts: 3, sleeper: async () => {} })
  ).rejects.toThrow("403");
  expect(calls()).toBe(3);
});
