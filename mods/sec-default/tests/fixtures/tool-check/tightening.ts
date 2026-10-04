import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that hears the verdict beneath it on
 * `tool.check`, then refuses the call whatever it heard.
 */
export const tightening: Plugin = {
  name: 'strict',
  register(on) {
    on('tool.check', async ($, e, next) => {
      await next(e)

      return { decision: 'deny', reason: 'a PreToolUse hook refused it' }
    })
  },
}
