import type Types from '../types'
import { finishedCallOf } from './finished-call-of'

/**
 * Oldest first. None where the host cannot read that conversation.
 *
 * @param messages what the host answered when asked for a conversation
 * @returns the calls of that conversation that have an answer
 */
export function finishedCallsOf(
  messages: Types.SessionRead,
): Types.FinishedCall[] {
  const isRead = Array.isArray(messages)

  return (isRead ? messages.flatMap(message => message.toolUses) : []).flatMap(
    toolUse => {
      const isUnfinished = toolUse.text === undefined || toolUse.isError

      return isUnfinished ? [] : [finishedCallOf(toolUse)]
    },
  )
}
