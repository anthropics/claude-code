import type CoreCall from '../../../call'
import Casting from '../../../casting'
import Texts from '../../../texts'
import { hasRowsToCombine } from '../../has-rows-to-combine'
import Limits from '../../limits'
import type Types from '../../types'
import Words from '../../words'
import { cellProblemIn } from './cell-problem-in'
import { COMBINERS } from './combiners'
import { formProblemIn } from './form-problem-in'
import { measuresNamed } from './measures-named'
import { readMark } from './read-mark'
import { readTable } from './read-table'
import { seriesOf } from './series-of'
import { sourcedFailure } from './sourced-failure'
import { subjectOf } from './subject-of'
import { timelineOf } from './timeline-of'
import { unitProblemIn } from './unit-problem-in'

/**
 * What the picked rows chart as, or a refusal that opens with their source.
 *
 * The model fixes one problem at a time: units, then cells, then the form.
 *
 * @param table the one table that was picked
 * @param request the chart that was asked for
 * @param clock the zone and the time of the call
 * @returns the data to draw, or the refusal
 */
export function dataOf(
  table: Casting.Table,
  request: CoreCall.ChartRequest,
  clock: Types.CallClock,
): Types.Data | Types.ReadFailure {
  const roles = Casting.rolesOf(table, request)
  const isRefusal = 'code' in roles

  if (isRefusal) {
    return sourcedFailure(table, roles)
  }

  const drawnForm = request.form ?? roles.form
  const reading = readTable(table, roles, request)
  const subject = subjectOf(measuresNamed(table, roles), request, reading)
  const isZoned = reading.readings.some(cellReading => cellReading.isZoned)
  const zone = isZoned ? clock.zone : 'UTC'
  const { series, emptyNames, times, grid } = seriesOf({
    reading,
    fallbackName: subject,
    combine: COMBINERS[request.combine ?? 'sum'],
    zone,
  })
  const timeline = timelineOf({
    times,
    grid,
    readAs: roles.form,
    zone,
    isZoned,
  })
  const problem =
    unitProblemIn(reading, roles, request) ??
    cellProblemIn({ reading, roles, request, series }) ??
    formProblemIn({ roles, request, series, timeline })

  if (problem !== undefined) {
    return sourcedFailure(table, problem)
  }

  const marks = (request.marks ?? []).map(mark =>
    readMark({ mark, drawnForm, axisSpan: timeline.axisSpan, isZoned }),
  )
  const isLastPeriodOpen =
    table.isReadAtInstants !== true &&
    isZoned &&
    grid !== null &&
    clock.nowMs !== null &&
    clock.nowMs >= timeline.dataSpan.untilMs &&
    clock.nowMs < grid.endMs
  const hasEmptyNames = emptyNames.length > 0
  const leftOutNotes = Texts.capped(
    reading.droppedColumns.map(column => column.sentence),
    Limits.MAX_DROPPED_COLUMNS_LISTED,
    'more column',
  )
  const notes = [
    ...(hasEmptyNames
      ? [
          `${emptyNames.length} with no value, not drawn: ` +
            Texts.truncateMiddle(emptyNames.join(', '), Limits.MAX_NAME_WIDTH),
        ]
      : []),
    ...marks.filter(mark => typeof mark === 'string'),
    ...(isLastPeriodOpen ? [Words.STILL_FILLING] : []),
  ]

  return {
    kind: 'data',
    form: drawnForm,
    source: table.source,
    path: table.path,
    isSeries: table.isSeries === true,
    subject,
    hasCombinedRows: hasRowsToCombine(reading),
    series,
    timeline,
    marks: marks
      .filter(mark => typeof mark !== 'string')
      .toSorted((left, right) => left.ms - right.ms),
    leftOutNotes,
    notes,
  }
}
