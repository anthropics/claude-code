/**
 * A cell that was read as a moment in time.
 */
export type TimeFound = {
  kind: 'time'

  /**
   * The moment, in milliseconds since the epoch.
   */
  ms: number

  /**
   * Whether the cell itself names a zone or an offset.
   */
  isZoned: boolean
}
