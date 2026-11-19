import type Reading from '../../../reading'
import type { Frame } from '../frame'
import type { Mark } from '../mark'
import type { Plot } from '../plot'

/**
 * A chart whose series run along a time axis.
 */
export type TimeChart = Frame & {
  form: 'line' | 'columns'
  plots: Plot[]
  timeline: Reading.Timeline
  marks: Mark[]

  /**
   * A note for a layout that has fewer cells than there are columns.
   */
  mergedColumnsNote: string

  /**
   * A note for a layout where a part of a stack is too thin to be drawn.
   */
  thinPartsNote: string

  /**
   * What may differ from screen to screen, for a reader who sees no screen.
   */
  modelOnlyNotes: string[]
}
