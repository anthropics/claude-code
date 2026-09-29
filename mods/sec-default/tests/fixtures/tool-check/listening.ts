import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that hears every `tool.check` and hands up
 * the verdict beneath it as it is, as one that only logs would.
 */
export const listening: Plugin = {
  name: 'listening',
  register(on) {
    on('tool.check', ($, e, next) => next(e))
  },
}
