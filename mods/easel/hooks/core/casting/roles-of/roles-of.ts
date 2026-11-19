import type CoreCall from '../../call'
import Cells from '../../cells'
import Lists from '../../lists'
import type Refusal from '../../refusal'
import Texts from '../../texts'
import { classifiedColumns } from '../classified-columns'
import { columnNamed } from '../column-named'
import { hasUnreadDates } from '../has-unread-dates'
import Limits from '../limits'
import Records from '../records'
import type Types from '../types'
import { columnNamedIn } from './column-named-in'
import { formedRoles } from './formed-roles'
import { hasDigit } from './has-digit'
import { isOtherThan } from './is-other-than'
import { missingColumnsProblem } from './missing-columns-problem'
import { onlyPossibleRoles } from './only-possible-roles'
import { usualFormOf } from './usual-form-of'

/**
 * Decides which column is the x axis, which hold the values and which split
 * the rows into series: after the rows are read, before the data is built.
 *
 * Each role comes from what was asked, else from the metrics format that was
 * read, else from the only way to read the columns. The format's roles run
 * over time, so bars do not use them. A `combine` with no `by` gets no split.
 *
 * @param table the columns and rows that were read
 * @param request what the call asked for
 * @returns the roles, or the reason that none can be given
 */
export function rolesOf(
  table: Types.Table,
  request: CoreCall.ChartRequest,
): Types.Roles | Refusal.Problem {
  const form =
    request.form === undefined ? undefined : Records.READ_AS[request.form]
  const formatRoles = form === 'bars' ? undefined : table.roles
  const columns = formatRoles ? [] : classifiedColumns(table)
  const inferred = formatRoles ?? onlyPossibleRoles(columns, form)

  const xName =
    request.x === undefined ? inferred?.x : columnNamed(table, request.x)
  const columnOf = columnNamedIn(table)
  const yNames = Lists.distinct(
    request.y?.map(columnOf) ?? inferred?.y ?? [],
  ).filter(isOtherThan(xName))
  const splitNames = (
    request.by?.map(columnOf) ??
    (request.combine === undefined ? inferred?.by : undefined) ??
    []
  ).filter(isOtherThan(xName))

  if (table.rows.length === 0) {
    return { code: 'no_rows', why: 'it has no rows' }
  }

  const hasSharedNames = new Set(table.columns).size < table.columns.length

  if (hasSharedNames) {
    return {
      code: 'names_repeat',
      why:
        'two of its columns share a name, so a name does not pick one. ' +
        'Pass the rows as data, each column under a name of its own',
    }
  }

  if (xName === undefined) {
    const dates = columns.find(hasUnreadDates)

    if (dates) {
      return {
        code: 'dates_unread',
        why:
          `${dates.name} looks like dates, in a spelling that is not read ` +
          `(${dates.cells[0]}). ${Cells.TIME_SPELLINGS}`,
      }
    }

    const timeColumns = columns.filter(column => column.soleKind === 'time')
    const times = timeColumns[0]
    const timeCount = new Set(times?.cells).size

    const hasTooFewTimes =
      times &&
      timeColumns.length === 1 &&
      timeCount < Limits.MIN_TIMES_FOR_A_LINE

    if (hasTooFewTimes) {
      return {
        code: 'few_times',
        why:
          `${times.name} holds ${Texts.counted(timeCount, 'time')}, too few ` +
          `to find the time axis unasked (that takes ` +
          `${Limits.MIN_TIMES_FOR_A_LINE}). Name x and y`,
      }
    }

    const hasPossibleNumber =
      (table.listColumns ?? []).length > 0 ||
      columns.some(column => column.cells.some(hasDigit))

    if (!hasPossibleNumber) {
      return {
        code: 'no_numbers',
        why:
          'no column holds a number, so there is nothing to draw. Rows ' +
          'are not counted: pass the counts as data',
      }
    }

    const hasY = yNames.length > 0

    return {
      code: 'no_x',
      why: hasY
        ? 'say which column is x'
        : 'say which column is x and which are y',
    }
  }

  if (yNames.length === 0) {
    return {
      code: 'no_y',
      why:
        `say which columns are y, the values to draw. Rows are not ` +
        `counted: for how many rows share a ${xName}, pass the counts as ` +
        `data`,
    }
  }

  const missing = [xName, ...yNames, ...splitNames].filter(
    name => !table.columns.includes(name),
  )

  const hasMissing = missing.length > 0

  return hasMissing
    ? missingColumnsProblem(missing, table)
    : formedRoles(
        form ?? inferred?.form ?? usualFormOf(columns, xName),
        xName,
        {
          y: yNames,
          by: splitNames,
        },
      )
}
