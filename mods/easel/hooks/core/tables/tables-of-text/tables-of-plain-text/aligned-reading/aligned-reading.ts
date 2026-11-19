import Patterns from '../../../patterns'
import { tableOfLines } from '../../../table-of-lines'
import type Types from '../../../types'
import Words from '../../../words'
import { cellsByPosition } from './cells-by-position'
import { hasNumberColumn } from './has-number-column'
import { isContent } from './is-content'

/**
 * `df -h` pads its columns with spaces.
 *
 * A single space can part two columns there, and a name such as
 * `Mounted on` can hold one, so no delimiter works.
 *
 * @param text the text, with no invisible codes
 * @returns the tables read by the positions of their columns, and their lines
 */
export function alignedReading(text: string): Types.Reading {
  const blocks = text
    .split(Patterns.BLANK_LINES)
    .map(paragraph => cellsByPosition(paragraph.split('\n').filter(isContent)))
    .filter(hasNumberColumn)

  return {
    lineCount: blocks.flat().length,
    tables: blocks.map(block => tableOfLines(block, Words.ALIGNED_SOURCE)),
  }
}
