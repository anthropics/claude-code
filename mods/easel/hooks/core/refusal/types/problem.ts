import type { RefusalCode } from './refusal-code'

/**
 * Why a chart is not drawn.
 */
export type Problem = {
  /**
   * The word for telemetry: one of the list and nothing else.
   */
  code: RefusalCode

  /**
   * The sentence for the model, which may quote the data.
   */
  why: string

  /**
   * Set where x holds names and nothing like a date, so that bars are the one
   * form left.
   */
  fitsBars?: true
}
