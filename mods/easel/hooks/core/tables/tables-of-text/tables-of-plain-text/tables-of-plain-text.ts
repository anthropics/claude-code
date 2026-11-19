import type Casting from '../../../casting'
import { DELIMITERS } from '../../delimiters'
import { alignedReading } from './aligned-reading'
import { delimitedReading } from './delimited-reading'
import { isOfLineCount } from './is-of-line-count'

/**
 * Reads by every delimiter present and by position, where there is no JSON.
 *
 * The most lines of the text inside tables win, and the earlier of a tie.
 *
 * @param plainText the text, with no invisible codes
 * @returns the tables of the reading that wins
 */
export function tablesOfPlainText(plainText: string): Casting.Table[] {
  const readings = [
    ...DELIMITERS.filter(delimiter => delimiter.pattern.test(plainText)).map(
      delimiter => delimitedReading(plainText, delimiter),
    ),
    alignedReading(plainText),
  ]

  return (
    readings.find(
      isOfLineCount(Math.max(...readings.map(reading => reading.lineCount))),
    )?.tables ?? []
  )
}
