import Lists from '../../../../lists'
import Limits from '../../../limits'
import Patterns from '../../../patterns'
import { tableOfLines } from '../../../table-of-lines'
import type Types from '../../../types'
import { rectangularBlocksOf } from './rectangular-blocks-of'
import { splitRows } from './split-rows'
import { withUnparsedCount } from './with-unparsed-count'

/**
 * Reads by one sign: the rows it splits, in blocks of one width.
 *
 * The count is in lines of the input: a quoted cell can hold line breaks.
 *
 * @param text the text, with no invisible codes
 * @param delimiter the sign that parts cells
 * @returns the tables of the blocks, and the lines they cover
 */
export function delimitedReading(
  text: string,
  delimiter: Types.Delimiter,
): Types.Reading {
  const lines = splitRows(text, delimiter).filter(
    row => !Patterns.SEPARATOR_LINE.test(row.join('')),
  )
  const blocks = rectangularBlocksOf(lines)
  const rowsInBlocks = blocks.flat()

  return {
    lineCount: rowsInBlocks.flatMap(row => row.join('').split('\n')).length,
    tables: blocks
      .map(block => tableOfLines(block, delimiter.source))
      .map(
        withUnparsedCount(
          Lists.countOf(lines, row => row.length >= Limits.MIN_ROW_CELLS) -
            rowsInBlocks.length,
        ),
      ),
  }
}
