import type { EventResult, On } from 'claude-code'

import { ASKED } from './asked.js'

/**
 * Answers every `tool.check` beneath the plugins with one verdict of a list,
 * the first until the answer is called, then the next; past the last, ASKED.
 *
 * @param on the test's `on`
 * @param verdicts what the engine's evaluation decides, call after call
 * @returns `() => void`: from then on the next verdict answers
 */
export function checksAnsweredInTurn(
  on: On,
  verdicts: readonly EventResult<'tool.check'>[],
) {
  let at = 0

  on('tool.check', () => verdicts[at] ?? ASKED)

  return () => {
    at += 1
  }
}
