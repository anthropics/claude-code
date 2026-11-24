import type { ToolCallRow } from '../tool-call-row'

/**
 * A call as the host draws it, and what its row holds of the result.
 */
export type DrawnRow = {
  /**
   * What the row tells of its call.
   */
  row: ToolCallRow

  /**
   * Whether the row holds the stored result whole.
   */
  hasWholeOutput: boolean

  /**
   * Whether the app may have shortened what the model read.
   */
  mayBeCut: boolean

  /**
   * Whether the row is of a page's own copy of the conversation, whose words
   * need not be the transcript's.
   */
  isOfAnotherCopy: boolean
}
