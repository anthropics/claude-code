import { test, expect } from "bun:test";
import { effectiveLabelAppliedAt, shouldClose, type LabelEvent } from "./label-events.ts";

// Helper: build a "labeled"/"unlabeled" event for `label` at a given time.
const ev = (event: string, label: string, created_at: string): LabelEvent => ({
  event,
  label: { name: label },
  created_at,
});

// The bug this replaces: the old code did
//   events.filter(e => e.event === "labeled" && e.label?.name === label)
//         .map(e => new Date(e.created_at)).pop()
// on only page 1 of the events endpoint (oldest-first, 100/page). Reproduce that
// old logic here so the tests document exactly what used to go wrong.
const oldLogic = (events: LabelEvent[], label: string): Date | undefined =>
  events
    .filter((e) => e.event === "labeled" && e.label?.name === label)
    .map((e) => new Date(e.created_at))
    .pop();

const cutoff = new Date("2026-01-10T00:00:00Z"); // "close if applied on/before this"

test("scenario A: label applied on page 2 (>100 events) is still detected", () => {
  // 100 unrelated older events (page 1), then the lifecycle label applied late
  // (page 2). The old single-page logic never sees it.
  const page1: LabelEvent[] = Array.from({ length: 100 }, (_, i) =>
    ev("referenced", "stale", `2025-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`)
  ).map((e) => ({ ...e, event: "referenced", label: undefined }));
  const page2 = [ev("labeled", "stale", "2025-12-20T00:00:00Z")];
  const all = [...page1, ...page2];

  // Old logic (page 1 only): finds nothing -> issue skipped forever.
  expect(oldLogic(page1, "stale")).toBeUndefined();

  // New logic (all pages): detects the application and it is before cutoff.
  const applied = effectiveLabelAppliedAt(all, "stale");
  expect(applied?.toISOString()).toBe("2025-12-20T00:00:00.000Z");
  expect(shouldClose(all, "stale", cutoff).close).toBe(true);
});

test("scenario B: labeled early, unlabeled, re-labeled recently -> uses recent timestamp", () => {
  const events = [
    ev("labeled", "stale", "2025-11-01T00:00:00Z"), // old application (before cutoff)
    ev("unlabeled", "stale", "2025-11-05T00:00:00Z"), // removed
    ev("labeled", "stale", "2026-01-15T00:00:00Z"), // re-applied recently (grace restarted)
  ];

  // Old logic keyed off an early "labeled" (before the cutoff) and would close the
  // issue even though its grace period restarted on 2026-01-15. Sanity-check that
  // an early-application view really is before the cutoff (would have closed):
  expect(events[0].created_at < cutoff.toISOString()).toBe(true);

  // New logic uses the most recent application, and is correct regardless of the
  // order events arrive in across pages:
  const shuffled = [events[2], events[0], events[1]]; // out of order on purpose
  const applied = effectiveLabelAppliedAt(shuffled, "stale");
  expect(applied?.toISOString()).toBe("2026-01-15T00:00:00.000Z");

  // Grace period restarted 2026-01-15, which is AFTER the cutoff -> must NOT close.
  expect(shouldClose(shuffled, "stale", cutoff).close).toBe(false);
});

test("scenario C: labeled then unlabeled, not re-applied -> treated as not labeled", () => {
  const events = [
    ev("labeled", "stale", "2025-11-01T00:00:00Z"),
    ev("unlabeled", "stale", "2025-11-05T00:00:00Z"),
  ];
  expect(effectiveLabelAppliedAt(events, "stale")).toBeNull();
  expect(shouldClose(events, "stale", cutoff).close).toBe(false);
});

test("only considers the matching label, ignores other labels' events", () => {
  const events = [
    ev("labeled", "needs-repro", "2025-12-01T00:00:00Z"),
    ev("labeled", "stale", "2025-12-15T00:00:00Z"),
    ev("unlabeled", "needs-repro", "2025-12-20T00:00:00Z"),
  ];
  expect(effectiveLabelAppliedAt(events, "stale")?.toISOString()).toBe(
    "2025-12-15T00:00:00.000Z"
  );
});

test("no events for the label -> null (not currently applied)", () => {
  expect(effectiveLabelAppliedAt([], "stale")).toBeNull();
  expect(
    effectiveLabelAppliedAt([ev("labeled", "invalid", "2025-12-01T00:00:00Z")], "stale")
  ).toBeNull();
});
