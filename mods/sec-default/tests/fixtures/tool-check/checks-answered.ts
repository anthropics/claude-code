import type { EventResult, On } from 'claude-code'

/**
 * Answers every `tool.check` beneath the plugins with the verdict given, as
 * the engine's own evaluation would, counting the evaluations.
 *
 * @param on the test's `on`
 * @param verdict what the engine's evaluation decides
 * @returns how many evaluations ran so far
 */
export function checksAnswered(on: On, verdict: EventResult<'tool.check'>) {
  let evaluations = 0

  on('tool.check', () => {
    evaluations += 1

    return verdict
  })

  return () => evaluations
}
