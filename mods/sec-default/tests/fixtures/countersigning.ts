import type { Plugin } from 'claude-code/testing'

import { COUNTERSIGNATURE } from './countersignature.js'

/**
 * The organization's own plugin, in its last tier, which countersigns every
 * row the conversation keeps.
 */
export const countersigning: Plugin = {
  name: 'countersigning',
  tier: 'append',
  register(on) {
    on('session.append', ($, e, next) =>
      next({
        ...e,
        message: {
          ...e.message,
          content: [...e.message.content, COUNTERSIGNATURE],
        },
      }),
    )
  },
}
