import type Calendar from '../../../calendar'
import type { Series } from '../series'

/**
 * The series with a value, the names of those with none, and their times.
 */
export type DrawnSeries = {
  series: Series[]
  emptyNames: string[]
  times: number[]
  grid: Calendar.SampleGrid | null
}
