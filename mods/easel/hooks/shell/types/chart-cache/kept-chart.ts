import type Easel from '../../../core/easel'

/**
 * What a finished call draws, and the words that a row must show to get it.
 */
export type KeptChart = {
  /**
   * What the call draws.
   */
  outcome: Easel.Outcome

  /**
   * The text of the result.
   */
  text: string

  /**
   * The query in the input, or no text for a chart call.
   */
  query: string
}
