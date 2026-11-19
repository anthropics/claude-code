import type Calendar from '../../../calendar'
import type CoreCall from '../../../call'
import type { Data } from '../data'

/**
 * What `readMark` places a mark from.
 */
export type MarkOptions = {
  mark: NonNullable<CoreCall.ChartRequest['marks']>[number]
  drawnForm: Data['form']
  axisSpan: Calendar.TimeSpan
  isZoned: boolean
}
