/**
 * What a hook knows of the call that a chart or refusal answered.
 */
export type UsedCall = {
  /**
   * Whether the model asked for the chart.
   */
  isAsked: boolean

  /**
   * The subagent that called, or undefined for the main conversation.
   */
  agentId: string | undefined

  /**
   * The time to read the data and lay it out; zero for a crash.
   */
  elapsedMs: number
}
