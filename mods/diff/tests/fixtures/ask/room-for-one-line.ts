import Ask from '../../../hooks/ask'
import { ASK_LINES } from './ask-lines.js'

/**
 * Room for ASK_LINES' heading line and the cut note only, so no hunk line.
 */
export const ROOM_FOR_ONE_LINE =
  (ASK_LINES[0]?.length ?? 0) + 1 + Ask.ASK_CUT_NOTE.length
