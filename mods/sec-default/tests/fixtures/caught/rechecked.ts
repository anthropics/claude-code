import type { EventResult, TargetTier, TraceEntry } from 'claude-code'

import { unchecked } from './unchecked.js'

/**
 * The `tool.check` hook's `next`: the call settles as the trace lists, and
 * `to` answers the run past the user tier.
 *
 * @param trace the run beneath, nearest the caller first
 * @param past what the run past the user tier settles to
 * @returns the stand-in
 */
export const rechecked = (
  trace: readonly TraceEntry<'tool.check'>[],
  past: EventResult<'tool.check'>,
) =>
  Object.assign(unchecked(trace), {
    to: (_e: unknown, _tier: TargetTier) => Promise.resolve(past),
  })
