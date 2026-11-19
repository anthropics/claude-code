import type Reading from '../../../reading'
import Usage from '../../../usage'
import type Types from '../../types'
import { pointCountOf } from './point-count-of'

/**
 * What telemetry is told of a chart that was drawn: its form and format,
 * how much of the data is in it, and whether a note says some is not.
 *
 * @param usage What is told of the call so far.
 * @param data The rows as they were read.
 * @returns What is told of the chart.
 */
export const drawnUsageOf = (
  usage: Types.DrawnChart['usage'],
  data: Reading.Data,
): Types.DrawnChart['usage'] => ({
  ...usage,
  outcome: 'drawn',
  form: data.form,
  format: Usage.formatOf(data),
  seriesCount: data.series.length,
  pointCount: pointCountOf(data),
  hasLeftOut: data.leftOutNotes.length > 0,
})
