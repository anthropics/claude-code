import type CoreCall from '../../../call'
import type Casting from '../../../casting'
import type { Mark } from '../mark'
import type { Series } from '../series'
import type { Timeline } from '../timeline'

/**
 * What every later stage draws: the series, their timeline and the notes.
 */
export type Data = {
  kind: 'data'
  form: NonNullable<CoreCall.ChartRequest['form']>
  source: Casting.Table['source']
  path: Casting.Table['path']

  /**
   * Whether a metrics service says that the values are measures over time.
   */
  isSeries: boolean

  /**
   * What the values measure, in words. It may be empty.
   */
  subject: string

  hasCombinedRows: boolean
  timeline: Timeline
  series: Series[]

  /**
   * Only those with a place on the time axis, in time order.
   */
  marks: Mark[]

  /**
   * Of cells, tables and lines that are in the text and not the chart.
   */
  leftOutNotes: string[]

  notes: string[]
}
