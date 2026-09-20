import type { SessionMessage } from 'claude-code'

import { editPatchOf } from './edit-patch-of.js'
import TurnDiffsOf from './turn-diffs-of'

/**
 * A transcript a resumed session brings back whose one turn edited a file:
 * the prompt, the Edit that landed, its result.
 */
export const EDITED_TRANSCRIPT: readonly SessionMessage[] = [
  TurnDiffsOf.promptOf('change a to b'),
  TurnDiffsOf.editsOf(editPatchOf(['-a', '+b'])),
  TurnDiffsOf.toolResults(),
]
