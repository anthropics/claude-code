// Helpers for working out a label's current state from an issue's
// labeled/unlabeled events. No I/O here so it's easy to unit test
// (see label-events.test.ts).

export interface LabelEvent {
  event: string;
  label?: { name: string };
  created_at: string;
}

// Given all of an issue's events, find when `label` was last applied and is
// still on the issue: the newest "labeled" event with no "unlabeled" for the
// same label after it. Returns null if the label isn't currently applied.
//
// We sort by created_at here instead of trusting the API's order (GitHub doesn't
// document how the events endpoint orders results), so callers can pass events
// from any page in any order.
export function effectiveLabelAppliedAt(
  events: LabelEvent[],
  label: string
): Date | null {
  const stream = events
    .filter(
      (e) =>
        (e.event === "labeled" || e.event === "unlabeled") &&
        e.label?.name === label
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  let appliedAt: Date | null = null;
  for (const e of stream) {
    appliedAt = e.event === "labeled" ? new Date(e.created_at) : null;
  }
  return appliedAt;
}

// Close an issue only if `label` is still applied and was last applied on or
// before `cutoff`.
export function shouldClose(
  events: LabelEvent[],
  label: string,
  cutoff: Date
): { close: boolean; appliedAt: Date | null } {
  const appliedAt = effectiveLabelAppliedAt(events, label);
  return { close: appliedAt !== null && appliedAt <= cutoff, appliedAt };
}
