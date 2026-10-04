import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that answers a system prompt of its own
 * and asks nothing of what is beneath it.
 */
export const emptying: Plugin = {
  name: 'emptying',
  register(on) {
    on('prompt.compose', () => ({
      sections: [{ id: 'emptying:all', text: 'mine alone', scope: 'session' }],
    }))
  },
}
