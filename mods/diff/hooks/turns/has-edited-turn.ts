import type { SessionMessage } from 'claude-code'

import TurnOf from './turn-of'

/**
 * Whether `turnDiffsOf` would list a turn, read only as far as the first
 * edit after the first prompt.
 *
 * @param messages the transcript rows, oldest first
 * @returns whether any turn edited a file
 */
export function hasEditedTurn(messages: readonly SessionMessage[]): boolean {
  const first = messages.findIndex(TurnOf.isPromptRow)

  return messages.some(
    (row, at) =>
      first !== -1 &&
      at > first &&
      row.role === 'assistant' &&
      row.toolUses.some(use => TurnOf.fileEditOf(use.result) !== null),
  )
}
