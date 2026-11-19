import type Refusal from '../../../../refusal'
import { hasRowsToCombine } from '../../../has-rows-to-combine'
import type Types from '../../../types'
import { timeAxisProblemIn } from './time-axis-problem-in'

/**
 * Refuses what the cells cannot support: mixed zones, an unread axis or
 * column, rows left to combine, or no number at all.
 *
 * @param options the table as read, its roles, the call and the series
 * @returns the reason to refuse, or undefined
 */
export function cellProblemIn({
  reading,
  roles,
  request,
  series,
}: Types.CellProblemOptions): Refusal.Problem | undefined {
  const hasMixedZones =
    new Set(reading.readings.map(cell => cell.isZoned)).size > 1

  if (hasMixedZones) {
    return {
      code: 'zones_mixed',
      why: `${roles.x} mixes times that name a zone with times that name none`,
    }
  }

  const timeAxisProblem = timeAxisProblemIn(roles, reading)

  if (timeAxisProblem !== undefined) {
    return timeAxisProblem
  }

  const entireColumn = reading.droppedColumns.find(
    column => column.isEntireColumn,
  )

  if (entireColumn !== undefined) {
    return {
      code: 'column_unread',
      why: `a whole column was not read. ${entireColumn.sentence}`,
    }
  }

  const hasRowsLeftToCombine =
    request.combine === undefined && hasRowsToCombine(reading)

  if (hasRowsLeftToCombine) {
    return {
      code: 'rows_share_x',
      why:
        `several rows share one ${roles.x}; name the columns to split by, ` +
        `or how to combine them (sum, mean, max, min)`,
    }
  }

  const hasNumber = series.length > 0

  if (!hasNumber) {
    return {
      code: 'no_values',
      why: `no cell of ${roles.y.join(', ')} holds a number`,
    }
  }

  const [firstDroppedColumn] = reading.droppedColumns
  const isPartOfARanking =
    roles.form === 'bars' && firstDroppedColumn !== undefined

  return isPartOfARanking
    ? {
        code: 'bars_partly_unread',
        why:
          `bars rank a whole list, and part of this one was not read. ` +
          `${firstDroppedColumn.sentence}`,
      }
    : undefined
}
