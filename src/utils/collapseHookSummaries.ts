import type {
  RenderableMessage,
  SystemStopHookSummaryMessage,
} from '../types/message.js'

function isLabeledHookSummary(
  msg: RenderableMessage,
): msg is SystemStopHookSummaryMessage {
  return (
    msg.type === 'system' &&
    msg.subtype === 'stop_hook_summary' &&
    msg.hookLabel !== undefined
  )
}

/**
 * Collapses consecutive hook summary messages with the same hookLabel
 * (e.g. PostToolUse) into a single summary. This happens when parallel
 * tool calls each emit their own hook summary.
 */
export function collapseHookSummaries(
  messages: RenderableMessage[],
): RenderableMessage[] {
  const result: RenderableMessage[] = []
  let i = 0

  while (i < messages.length) {
    const msg = messages[i]!
    if (isLabeledHookSummary(msg)) {
      const label = msg.hookLabel
      const group: SystemStopHookSummaryMessage[] = []
      while (i < messages.length) {
        const next = messages[i]!
        if (!isLabeledHookSummary(next) || next.hookLabel !== label) break
        group.push(next)
        i++
      }
      if (group.length === 1) {
        result.push(msg)
      } else {
        result.push({
          ...msg,
          hookCount: group.reduce((sum, m) => sum + m.hookCount, 0),
          hookInfos: group.flatMap(m => m.hookInfos),
          hookErrors: group.flatMap(m => m.hookErrors),
          preventedContinuation: group.some(m => m.preventedContinuation),
          hasOutput: group.some(m => m.hasOutput),
          // Parallel tool calls' hooks overlap; max is closest to wall-clock.
          totalDurationMs: Math.max(...group.map(m => m.totalDurationMs ?? 0)),
        })
      }
    } else {
      result.push(msg)
      i++
    }
  }

  return result
}
