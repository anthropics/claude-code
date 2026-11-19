import type { EngineInterface } from 'claude-code'

import type Shell from '../shell'
import { finishedCallsOf } from '../shell/finished-calls-of'
import { hasCallInFlight } from '../shell/has-call-in-flight'

/**
 * The answers that a chart call may read. It reads the transcript again after
 * each wait, until every call made before it has an answer or no wait is left.
 *
 * @param $ the host, for the transcript and the waits
 * @param made the chart call, and the signal that ends its waits
 * @param waitsMs the waits left, none for a single read
 * @returns the answered calls, oldest first, or undefined on a refused read
 */
export async function answeredCalls(
  $: EngineInterface,
  made: Shell.MadeCall,
  waitsMs: readonly number[],
): Promise<Shell.FinishedCall[] | undefined> {
  const { agentId } = made
  const [waitMs, ...laterMs] = waitsMs
  const messages = await $.session.messages(agentId ? { agentId } : {})
  const isRead =
    waitMs === undefined || !hasCallInFlight(messages, made.tool_use_id)

  if (isRead) {
    return Array.isArray(messages) ? finishedCallsOf(messages) : undefined
  }

  await $.clock.sleep(waitMs, { signal: made.signal })

  return answeredCalls($, made, laterMs)
}
