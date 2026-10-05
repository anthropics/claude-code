import type { Args, EventResult, TraceEntry } from 'claude-code'

/**
 * The `tool.check` failure handler's `next` for a hook that had not called
 * it: the call runs the links beneath, which settle as the trace lists.
 *
 * @param trace the run beneath, nearest the caller first
 * @returns the stand-in, answering what the first link settled on
 */
export function unchecked(trace: readonly TraceEntry<'tool.check'>[]) {
  const settled = trace[0]?.returned
  const isUnsettled = settled === undefined

  return Object.assign(
    (_e: Args<'tool.check'>): Promise<EventResult<'tool.check'>> =>
      isUnsettled
        ? Promise.reject(new Error('nothing settled'))
        : Promise.resolve(settled),
    { trace, called: false },
  )
}
