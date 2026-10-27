import type { SessionMessage } from 'claude-code'

import TurnOf from './turn-of'
import type Types from './types'

/**
 * The transcript's turns that edited files, newest first, each numbered by
 * its place among all prompts, read over `$.session.messages()`.
 *
 * Recomputed whole from the rows given, so a rewind that shrinks the
 * transcript simply yields fewer turns.
 *
 * @param messages the transcript rows, oldest first
 * @returns the turns with edits, newest first
 */
export function turnDiffsOf(
  messages: readonly SessionMessage[],
): Types.TurnDiff[] {
  const starts = messages.flatMap((message, at) =>
    TurnOf.isPromptRow(message) ? [at] : [],
  )

  return starts
    .map((start, ordinal) =>
      TurnOf.turnOf(messages.slice(start, starts[ordinal + 1]), ordinal + 1),
    )
    .filter(turn => turn.files.length > 0)
    .toReversed()
}
