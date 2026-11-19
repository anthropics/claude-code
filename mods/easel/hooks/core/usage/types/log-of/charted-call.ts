/**
 * What the shell knows of the call that a chart or refusal answered.
 */
export type ChartedCall = {
  /**
   * Whether the model asked for the chart.
   */
  isAsked: boolean

  /**
   * Whether a subagent made the call.
   */
  isInSubagent: boolean

  /**
   * Where the session is watched from.
   */
  surfaces: readonly string[]

  /**
   * The time to read the data and lay it out.
   */
  elapsedMs: number
}
