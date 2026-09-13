import Ask from '../../../hooks/ask'
import { ASK_LINES } from './ask-lines.js'

/**
 * Room for ASK_LINES' first two lines and the cut note, each line with its
 * newline, and not a character more.
 */
export const ROOM_FOR_TWO_LINES = ASK_LINES.slice(0, 2).reduce(
  (sum, line) => sum + line.length + 1,
  Ask.ASK_CUT_NOTE.length,
)
