/**
 * Kept with the result of a chart call, for later redraws.
 */
export type StoredClock = {
  /**
   * The time of the call, or null where it was lost.
   */
  nowMs: number | null

  /**
   * The time zone that the dates of the chart are in.
   */
  zone: string
}
