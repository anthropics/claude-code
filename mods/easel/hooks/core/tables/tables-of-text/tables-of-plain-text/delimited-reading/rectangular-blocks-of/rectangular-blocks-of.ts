import Casting from '../../../../../casting'
import Limits from '../../../../limits'

/**
 * Gathers runs of lines of one width; a run of a single line is no block.
 *
 * One line of another width between two that fit is only left out: a stray
 * delimiter, as in `1,400`, cuts no table.
 *
 * @param rows the cells of each line, in order
 * @returns the blocks, each of lines of one width
 */
export function rectangularBlocksOf(rows: string[][]): string[][][] {
  const blocks: string[][][] = []
  let block: string[][] = []

  for (const [rowIndex, row] of rows.entries()) {
    const isTableRow =
      row.length >= Limits.MIN_ROW_CELLS &&
      row.length <= Casting.MAX_COLUMNS &&
      row.some(cell => cell !== '')
    const width = block[0]?.length ?? row.length
    const isOfBlockWidth = isTableRow && row.length === width

    if (isOfBlockWidth) {
      block.push(row)
      continue
    }

    const isStrayRow = isTableRow && rows[rowIndex + 1]?.length === width

    if (!isStrayRow) {
      blocks.push(block)
      block = isTableRow ? [row] : []
    }
  }

  blocks.push(block)

  return blocks.filter(block => block.length >= Limits.MIN_BLOCK_LINES)
}
