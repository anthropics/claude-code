import Patterns from '../../patterns'
import { storedTextOf } from '../../stored-text-of'
import type Types from '../../types'

/**
 * One answered call, under the names that the pipeline reads.
 *
 * A hook can rewrite what the model reads, and the stored result then still
 * holds the words that it took out. The host itself adds to the text, or puts a
 * note in its place.
 *
 * @param toolUse the tool use as the host lists it, with its answer
 * @returns the call, its text read from the stored result where that has some
 *   and no hook rewrote it
 */
export function finishedCallOf(
  toolUse: Types.ListedToolUse,
): Types.FinishedCall {
  const readText = toolUse.text ?? ''
  const stored = storedTextOf(toolUse.result, readText)
  const isAsStored =
    readText.includes(stored.trim()) ||
    (Patterns.HOST_NOTE.test(readText) && !Patterns.HOST_NOTE.test(stored))

  return {
    id: toolUse.tool_use_id,
    tool: toolUse.tool,
    input: toolUse.input,
    storedResult: toolUse.result,
    text: isAsStored ? stored : readText,
    readText,
  }
}
