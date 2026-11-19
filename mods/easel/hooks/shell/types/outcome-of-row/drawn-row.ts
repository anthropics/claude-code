import type { ToolCallRow } from '../tool-call-row'

/**
 * A call as the host draws it, and whether the host passed its result whole.
 */
export type DrawnRow = {
  /**
   * What the row tells of its call.
   */
  row: ToolCallRow

  /**
   * Whether the row holds the result whole, not a shortened copy.
   */
  hasWholeOutput: boolean
}
