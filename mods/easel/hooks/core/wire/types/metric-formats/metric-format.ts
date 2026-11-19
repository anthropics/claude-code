/**
 * Paths for `valuesAt`. All but `series` start at one series.
 */
export type MetricFormat = {
  /**
   * What the service is called, told as the source of the points.
   */
  name: string

  /**
   * An empty path is the root itself.
   */
  series: string

  /**
   * To a record of labels, or to one text.
   */
  labels: string[]

  /**
   * To the instant of every point.
   */
  time: string

  /**
   * To the measure of every point.
   */
  value: string

  /**
   * Whether a value is read at its time, or counted up to it. Else its time
   * may start a period of counting, and the last may not be over.
   */
  isReadAtInstants: boolean

  /**
   * To what the measures are counted in, where the service states it.
   */
  unit?: string
}
