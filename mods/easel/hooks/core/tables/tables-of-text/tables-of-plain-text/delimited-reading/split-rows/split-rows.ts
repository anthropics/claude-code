import Patterns from '../../../../patterns'
import type Types from '../../../../types'

/**
 * A quote opens a quoted cell only at the start of a cell.
 *
 * Inside, parting signs and line breaks are part of the cell and `""` is a
 * quote. The outer pipes of `| a | b |` leave an empty cell at each end.
 *
 * @param text the text, with no invisible codes
 * @param delimiter the sign that parts cells
 * @returns the cells of each row, trimmed and without emphasis
 */
export function splitRows(
  text: string,
  delimiter: Types.Delimiter,
): string[][] {
  const cellPattern = new RegExp(
    `[ ]*(?:"(?<quoted>(?:[^"]|"")*)"[ ` +
      `]*|(?<plain>[^\\n]*?))(?<end>${delimiter.pattern.source}|\\n)`,
    'gy',
  )
  const closedRows: string[][] = []
  let openRow: string[] = []

  for (const { groups = {} } of `${text}\n`.matchAll(cellPattern)) {
    openRow.push(groups.quoted?.replaceAll('""', '"') ?? groups.plain ?? '')

    if (groups.end === '\n') {
      closedRows.push(openRow)
      openRow = []
    }
  }

  return [...closedRows, openRow].map(cells => {
    const hasBorder =
      delimiter.pattern.test('|') && cells[0] === '' && cells.at(-1) === ''

    return (hasBorder ? cells.slice(1, -1) : cells).map(cell =>
      cell.trim().replace(Patterns.EMPHASIS, '').replace(Patterns.LINK, '$1'),
    )
  })
}
