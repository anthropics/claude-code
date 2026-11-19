import CoreCall from '../../core/call'
import type Types from '../types'

/**
 * Whether the turn holds another tool's call, made before the one named, that
 * the transcript has no answer of yet. An older turn's call with none was cut
 * off, and never gets one.
 *
 * @param messages what the host answered when asked for a conversation
 * @param id the id of the chart call that reads the others' answers
 * @returns whether an answer may still be to come
 */
export function hasCallInFlight(
  messages: Types.SessionRead,
  id: string,
): boolean {
  const rows = Array.isArray(messages) ? messages : []
  const promptAt = rows.findLastIndex(
    row => row.role === 'user' && !row.toolResults?.length,
  )
  const calls = rows.slice(promptAt + 1).flatMap(row => row.toolUses)
  const ownAt = calls.findIndex(call => call.tool_use_id === id)

  return calls
    .slice(0, ownAt < 0 ? undefined : ownAt)
    .some(call => call.text === undefined && call.tool !== CoreCall.TOOL_NAME)
}
