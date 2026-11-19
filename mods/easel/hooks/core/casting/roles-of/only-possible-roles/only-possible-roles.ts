import { hasUnreadDates } from '../../has-unread-dates'
import Limits from '../../limits'
import type Types from '../../types'
import { hasClearSplit } from './has-clear-split'
import { hasFittingY } from './has-fitting-y'
import { isDifferentInTime } from './is-different-in-time'
import { nameOf } from './name-of'

/**
 * Finds the roles where the kinds of the cells leave one reading only.
 *
 * A column with no name is a row count and is ignored. A number column that
 * repeats the times of x as epochs is no measure.
 *
 * @param allColumns every column that was read, the unnamed ones too
 * @param form the reading that was asked for, where one was
 * @returns the roles, or undefined where several readings or none are left
 */
export function onlyPossibleRoles(
  allColumns: Types.Column[],
  form?: Types.Roles['form'],
): Types.Roles | undefined {
  const columns = allColumns.filter(column => column.name !== '')
  const textColumns = columns.filter(column => column.soleKind === 'text')
  const numberColumns = columns.filter(column => column.soleKind === 'number')
  const timeColumns = columns.filter(
    column =>
      column.cellsByKind.get('time')?.length === column.cells.length &&
      new Set(column.cells).size >= Limits.MIN_TIMES_FOR_A_LINE,
  )
  const isOverTime = timeColumns.length > 0
  const [xColumn, ...otherCandidates] = isOverTime ? timeColumns : textColumns

  const hasSingleX = xColumn !== undefined && otherCandidates.length === 0

  if (!hasSingleX) {
    return undefined
  }

  const yColumns = isOverTime
    ? numberColumns.filter(column => isDifferentInTime(column, xColumn))
    : numberColumns
  const splitColumns = textColumns.filter(column => column !== xColumn)
  const chosenForm = form ?? (isOverTime ? 'line' : 'bars')

  const hasOneReading =
    1 + splitColumns.length + numberColumns.length === columns.length &&
    hasClearSplit(splitColumns, xColumn) &&
    (isOverTime || chosenForm === 'bars') &&
    (form !== undefined || !hasUnreadDates(xColumn)) &&
    hasFittingY(yColumns, chosenForm)

  return hasOneReading
    ? {
        form: chosenForm,
        x: xColumn.name,
        y: yColumns.map(nameOf),
        by: splitColumns.map(nameOf),
      }
    : undefined
}
