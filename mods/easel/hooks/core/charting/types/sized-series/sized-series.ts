import type Reading from '../../../reading'

/**
 * A series with what the selection and the scales need of it.
 */
export type SizedSeries = Reading.Series & {
  /**
   * Without the gaps. There is at least one.
   */
  values: number[]

  /**
   * The largest absolute value.
   */
  size: number

  /**
   * Whether it stands for all the series that are too many to draw.
   */
  isOthers: boolean
}
