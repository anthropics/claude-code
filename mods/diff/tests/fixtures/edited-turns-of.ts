import type { SessionMessage } from 'claude-code'

import { editPatchOf } from './edit-patch-of.js'
import TurnDiffsOf from './turn-diffs-of'

/**
 * A transcript of that many prompts, each of which edited a file.
 *
 * @param count how many turns
 * @returns the rows, oldest first
 */
export function editedTurnsOf(count: number): SessionMessage[] {
  return Array.from({ length: count }, (_, at) => [
    TurnDiffsOf.promptOf(`change ${at + 1}`),
    TurnDiffsOf.editsOf(editPatchOf(['-a', '+b'])),
    TurnDiffsOf.toolResults(),
  ]).flat()
}
