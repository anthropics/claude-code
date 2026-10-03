import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that sets `corp_proxy`, `CORP_PROXY` in
 * another case, when the session starts; a refusal is kept from the session.
 */
export const settingLowerCase: Plugin = {
  name: 'lower',
  register(on) {
    on('session.start', async ($, e, next) => {
      await $.env.set('corp_proxy', 'mine').catch(() => undefined)

      return next(e)
    })
  },
}
