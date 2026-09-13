import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that marks all four subject events.
 *
 * A tool's description, a command's hidden flag, an agent's offer, a
 * spawn's model.
 */
export const marking: Plugin = {
  name: 'marking',
  register(on) {
    on('tool.describe', ($, e) => ({ description: `user: ${e.description}` }))
    on('command.describe', ($, e, next) => next({ ...e, isHidden: true }))
    on('agent.offer', () => ({ isOffered: false }))
    on('agent.spawn', () => ({ model: 'user' }))
  },
}
