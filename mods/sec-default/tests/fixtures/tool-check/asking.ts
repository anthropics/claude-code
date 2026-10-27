import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that hears the verdict beneath it on
 * `tool.check`, then puts the call to the person whatever it heard.
 *
 * @param name the plugin's name
 * @returns the plugin
 */
export const asking = (name: string): Plugin => ({
  name,
  register(on) {
    on('tool.check', async ($, e, next) => {
      await next(e)

      return { decision: 'ask', reason: 'Bash needs approval' }
    })
  },
})
