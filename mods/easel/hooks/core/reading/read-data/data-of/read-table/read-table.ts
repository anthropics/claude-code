import type CoreCall from '../../../../call'
import type Casting from '../../../../casting'
import Cells from '../../../../cells'
import Lists from '../../../../lists'
import Texts from '../../../../texts'
import Limits from '../../../limits'
import Records from '../../../records'
import type Types from '../../../types'
import { cellIn } from './cell-in'
import { cellReadingIn } from './cell-reading-in'
import { inNamedUnit } from './in-named-unit'
import { OFF_A_LOG_SCALE } from './off-a-log-scale'

/**
 * A cell that cannot be read is counted and quoted, never guessed.
 *
 * The x of bars holds no times: it is one more column to split the rows by. A
 * split column of a single value tells no series apart: the value goes to the
 * header.
 *
 * @param table the rows and the names of their columns
 * @param roles what each column is read as
 * @param request the chart that was asked for
 * @returns the cells as read, with what could not be
 */
export function readTable(
  table: Casting.Table,
  roles: Casting.Roles,
  request: CoreCall.ChartRequest,
): Types.TableReading {
  const cellAt = cellIn(
    new Map(table.columns.map((column, index) => [column, index])),
  )
  const firstRow = table.rows[0] ?? []
  const varyingColumns = roles.by.filter(column =>
    table.rows.some(row => cellAt(column, row) !== cellAt(column, firstRow)),
  )
  const isBars = roles.form === 'bars'
  const splitColumns = isBars ? [roles.x, ...varyingColumns] : varyingColumns
  const readings: Types.CellReading[] = []
  const unreadCells: Types.UnreadCell[] = []
  const unreadXCells: Cells.Cell[] = []

  for (const row of table.rows) {
    const time = isBars ? Records.NO_TIME : Cells.readTime(cellAt(roles.x, row))
    const isUnreadTime = time.kind === 'unread'

    if (isUnreadTime) {
      unreadXCells.push(cellAt(roles.x, row))
    }

    const isRowLeftOut = time.kind !== 'time'

    if (isRowLeftOut) {
      unreadCells.push({
        column: roles.x,
        quote: `${cellAt(roles.x, row)} (${time.why})`,
      })
      continue
    }

    const readingOf = cellReadingIn(
      time,
      splitColumns.map(
        column => String(cellAt(column, row) ?? '') || `no ${column}`,
      ),
      roles,
    )

    for (const column of roles.y) {
      const cell = cellAt(column, row)
      const scaled = inNamedUnit(
        Cells.readNumber(cell, request.y !== undefined),
        request,
      )
      const isOffTheScale =
        request.log === true && scaled.kind === 'number' && scaled.value <= 0
      const numeric = isOffTheScale ? OFF_A_LOG_SCALE : scaled
      const isUnreadNumber = numeric.kind === 'unread'

      if (isUnreadNumber) {
        unreadCells.push({ column, quote: `${cell} (${numeric.why})` })
      }

      readings.push(readingOf(column, numeric))
    }
  }

  const units = new Map<string, string[]>()

  for (const [column, group] of Lists.groupBy(
    readings,
    reading => reading.column,
  )) {
    units.set(
      column,
      Lists.distinct(
        group.map(reading => reading.unit).filter(unit => unit !== null),
      ),
    )
  }

  return {
    readings,
    units,
    sharedLabels: roles.by
      .filter(column => !varyingColumns.includes(column))
      .map(column => String(cellAt(column, firstRow) ?? '')),
    droppedColumns: [...Lists.groupBy(unreadCells, cell => cell.column)].map(
      ([column, cells]) => ({
        isEntireColumn: cells.length === table.rows.length,
        sentence:
          `${Texts.counted(cells.length, 'cell')} of ${column} not read: ` +
          cells
            .slice(0, Limits.MAX_UNREAD_CELLS_QUOTED)
            .map(cell => cell.quote)
            .join(', '),
      }),
    ),
    unreadXCells,
  }
}
