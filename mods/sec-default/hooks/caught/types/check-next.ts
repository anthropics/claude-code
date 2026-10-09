import type { Args, EventResult, TraceEntry } from 'claude-code'

/**
 * What the `tool.check` failure handler needs of its `next`: the call, and
 * the trace of the run it answers from.
 */
export type CheckNext = {
  (e: Args<'tool.check'>): Promise<EventResult<'tool.check'>>

  /**
   * What settled beneath the hook on its latest call (Next's).
   */
  readonly trace: readonly TraceEntry<'tool.check'>[]
}
