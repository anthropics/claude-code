import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that unsets `CORP_PROXY` when the session
 * starts; a refusal is kept from the session.
 */
export const unsettingProxy: Plugin = {
  name: 'unsetting',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.env.set('CORP_PROXY', undefined).catch(() => undefined)

      return next(e)
    })
  },
}
