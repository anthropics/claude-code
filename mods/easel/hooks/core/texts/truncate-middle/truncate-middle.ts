import Lists from '../../lists'
import { graphemesOf } from '../graphemes-of'
import Limits from '../limits'
import { widthOf } from '../width-of'
import Words from '../words'

/**
 * Cuts a string to a width by putting an ellipsis in place of its middle.
 *
 * Names in a chart often differ only at the start or only at the end.
 *
 * @param text the string to cut
 * @param maxWidth the most cells the result may take
 * @returns the string when it fits, else its two ends around an ellipsis
 */
export function truncateMiddle(text: string, maxWidth: number): string {
  const isWithin = widthOf(text) <= maxWidth

  if (isWithin) {
    return text
  }

  if (maxWidth < Limits.ELLIPSIS_WIDTH) {
    return ''
  }

  const graphemes = graphemesOf(text)
  const headWidth = Math.ceil(
    (maxWidth - Limits.ELLIPSIS_WIDTH) / Limits.ENDS_KEPT,
  )

  return (
    Lists.takeWithin(graphemes, headWidth, widthOf).join('') +
    Words.ELLIPSIS +
    Lists.takeWithin(
      graphemes.toReversed(),
      maxWidth - Limits.ELLIPSIS_WIDTH - headWidth,
      widthOf,
    )
      .toReversed()
      .join('')
  )
}
