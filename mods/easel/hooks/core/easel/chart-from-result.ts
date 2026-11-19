import type CoreCall from '../call'
import Reading from '../reading'
import Texts from '../texts'
import Usage from '../usage'
import Wire from '../wire'
import { drawnChartOf } from './drawn-chart-of'
import type Types from './types'

/**
 * The unasked entry point: draws only the answer of a metrics service, which
 * says itself what is time, value and label.
 *
 * Any other table may hold numbers that measure nothing, such as an id or a
 * postcode, and only the model can tell: it asks.
 *
 * The time of the call adds a note alone, so a redraw that lost it draws the
 * same lines.
 *
 * @param text What a tool answered.
 * @param call When it answered, and what it was asked.
 * @returns The chart drawn, or none.
 */
export function chartFromResult(
  text: string,
  call: Types.ResultCall,
): Types.DrawnChart | Types.NoChart {
  const request: CoreCall.ChartRequest = { form: 'line' }
  const read = Reading.readData(text, request, {
    zone: 'UTC',
    nowMs: call.nowMs,
  })
  const isWholeSeries =
    read.kind === 'data' && read.isSeries && read.leftOutNotes.length === 0

  if (!isWholeSeries) {
    return { kind: 'none' }
  }

  const name = Texts.cleanLabel(call.query.replaceAll('\n', ' '))
  const isNamedByCall = read.subject.toLowerCase() === Wire.VALUE && name !== ''
  const subject = isNamedByCall ? name : read.subject

  return drawnChartOf(
    {
      ...read,
      subject,
      series: read.series.map(series =>
        series.name === read.subject ? { ...series, name: subject } : series,
      ),
    },
    request,
    { ...Usage.NOTHING_DRAWN, dataFrom: 'last_result' },
  )
}
