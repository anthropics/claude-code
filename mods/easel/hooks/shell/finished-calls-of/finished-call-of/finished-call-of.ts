import { storedTextOf } from '../../stored-text-of'
import type Types from '../../types'

/**
 * One answered call, under the names that the pipeline reads.
 *
 * @param toolUse the tool use as the host lists it, with its answer
 * @returns the call, its text read from the stored result where that has some
 */
export const finishedCallOf = (
  toolUse: Types.ListedToolUse,
): Types.FinishedCall => ({
  id: toolUse.tool_use_id,
  tool: toolUse.tool,
  input: toolUse.input,
  storedResult: toolUse.result,
  text: storedTextOf(toolUse.result, toolUse.text),
})
