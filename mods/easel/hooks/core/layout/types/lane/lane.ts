/**
 * The room for a row's ink, between its name and its stats.
 */
export type Lane = {
  minWidth: number

  /**
   * How many leading stats get room before the lane and whole names do.
   */
  statsBeforeNames: number
}
