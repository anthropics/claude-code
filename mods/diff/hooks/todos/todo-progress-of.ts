import type { SessionMessage } from 'claude-code'

import { arrayOf } from '../array-of'
import { countOf } from '../count-of'
import { isRecord } from '../is-record'
import Tools from '../tools'
import type { TodoProgress } from './todo-progress'

/**
 * The todo list as the latest TodoWrite call left it, counted: the pane's
 * progress bar (ReplDiffSidebar's, read from the transcript instead).
 *
 * No call yet reads as an empty list.
 *
 * @param messages the transcript rows, oldest first
 * @returns completed over total
 */
export function todoProgressOf(
  messages: readonly SessionMessage[],
): TodoProgress {
  const latest = messages
    .flatMap(message => message.toolUses)
    .findLast(use => use.tool === Tools.TODO_TOOL)

  const statuses = arrayOf(latest?.input.todos).map(todo =>
    isRecord(todo) ? todo.status : null,
  )

  return {
    done: countOf(statuses, status => status === 'completed'),
    total: statuses.length,
  }
}
