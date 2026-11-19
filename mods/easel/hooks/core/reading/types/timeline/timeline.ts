import type { Step } from '../../../calendar/types/step/step'
import type { TimeSpan } from '../../../calendar/types/time-span'

/**
 * The time axis of a chart: its span, its step and the labels of both.
 */
export type Timeline = {
  /**
   * From the first sample to the last.
   */
  dataSpan: TimeSpan

  /**
   * Columns end where their last period ends.
   */
  axisSpan: TimeSpan

  /**
   * The finest calendar unit that the times use. Times are written in it.
   */
  precision: Step

  /**
   * The even step of all the samples, or `precision` if they keep none.
   */
  step: Step

  /**
   * Bars have none.
   */
  spanLabels: string[]

  /**
   * Only columns have periods.
   */
  periodStarts: number[]
}
