import type { EventResult, TraceEntry } from 'claude-code'

import Verdicts from './verdicts'

/**
 * What the `tool.check` hook's failure handler answers from the one run it
 * can read, the failed hook's last: that run's verdict, or a refusal.
 *
 * A deny stands, and so does a verdict no link that may hold a person's
 * plugin loosened. A loosened one, or none at all, met no deny rule.
 *
 * @param last what that run settled on; undefined when it rejected
 * @param trace that run's `next.trace`
 * @returns the verdict the handler returns
 */
export function caughtAnswer(
  last: EventResult<'tool.check'> | undefined,
  trace: readonly TraceEntry<'tool.check'>[],
) {
  const isVouched =
    last !== undefined &&
    (last.decision === 'deny' || Verdicts.loosenedByUsers(trace).length === 0)

  return isVouched ? last : Verdicts.UNCHECKED_DENY
}
