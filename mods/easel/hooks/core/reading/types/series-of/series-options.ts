import type { Combiner } from '../combiner'
import type { TableReading } from '../table-reading'

/**
 * What `seriesOf` draws series from.
 */
export type SeriesOptions = {
  reading: TableReading
  fallbackName: string

  /**
   * Makes one value of the rows that share a sample.
   */
  combine: Combiner

  zone: string
}
