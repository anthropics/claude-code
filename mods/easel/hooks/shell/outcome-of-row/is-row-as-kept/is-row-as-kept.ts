import Limits from '../../limits'
import Patterns from '../../patterns'
import { storedTextOf } from '../../stored-text-of'
import type Types from '../../types'

/**
 * A hook above can rewrite what a row shows. An app itself trims a result, and
 * some cut its end or shorten the note that the host put in its place.
 *
 * @param drawn the call as the app draws it
 * @param call the same call as the transcript holds it
 * @returns whether the row shows the words that the transcript holds
 */
export function isRowAsKept(
  drawn: Types.DrawnRow,
  call: Types.FinishedCall,
): boolean {
  const text = storedTextOf(drawn.row.output)
  const isWhole = text === call.readText || text.includes(call.text.trim())

  if (isWhole || !drawn.mayBeCut) {
    return isWhole
  }

  return Patterns.HOST_NOTE.test(call.readText)
    ? call.readText.includes(text)
    : text.length >= Limits.MIN_CUT_CHARS && call.text.startsWith(text)
}
