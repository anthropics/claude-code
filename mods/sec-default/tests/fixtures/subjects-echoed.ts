import type { On } from 'claude-code'

/**
 * Answers the four subject events beneath every plugin as the engine's
 * core would.
 *
 * The description and hidden flag the chain left, the agent offered, the
 * spawn on the model `core`.
 *
 * @param on the test's `on`
 */
export function subjectsEchoed(on: On) {
  on('tool.describe', ($, e) => ({ description: e.description }))

  on('command.describe', ($, e) => ({
    description: e.description,
    isHidden: e.isHidden,
  }))

  on('agent.offer', () => ({ isOffered: true }))
  on('agent.spawn', () => ({ model: 'core' }))
}
