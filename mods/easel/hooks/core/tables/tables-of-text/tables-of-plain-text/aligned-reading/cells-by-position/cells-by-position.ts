import Casting from '../../../../../casting'
import Lists from '../../../../../lists'
import Patterns from '../../../../patterns'
import type Types from '../../../../types'
import { cellsOfLineIn } from './cells-of-line-in'
import { columnsOfFields } from './columns-of-fields'

/**
 * A rule of dashes counts: each stroke covers the spaces inside its column.
 *
 * A field starts where no used position comes before, and ends likewise.
 *
 * @param lines the lines of one paragraph, rules among them
 * @returns the cells of each line that is not a rule, by column
 */
export function cellsByPosition(lines: string[]): string[][] {
  const isUsed: boolean[] = []

  for (const line of lines) {
    for (let position = 0; position < line.length; position++) {
      isUsed[position] ||= line[position] !== ' '
    }
  }

  const usedPositions = [...isUsed.keys()].filter(position => isUsed[position])
  const fields: Types.Field[] = Lists.zip(
    usedPositions.filter(position => !isUsed[position - 1]),
    usedPositions.filter(position => !isUsed[position + 1]),
  ).map(([start, last]) => ({ from: start, until: last + 1 }))
  const isOversized = Casting.isTooLarge(fields.length, lines.length)

  if (isOversized) {
    return []
  }

  const rows = lines.filter(line => !Patterns.SEPARATOR_LINE.test(line))

  return rows.map(
    cellsOfLineIn(
      columnsOfFields(
        fields,
        rows,
        lines.filter(line => Patterns.SEPARATOR_LINE.test(line)),
      ),
    ),
  )
}
