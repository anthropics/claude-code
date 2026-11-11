import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the organization seats that removes Bash from the session.
 */
export const removingAsOrg: Plugin = {
  name: 'suite',
  tier: 'append',
  register(on) {
    on('tool.list', async ($, e, next) => {
      const listed = await next(e)
      const { value } = listed
      const isListed = value !== undefined

      return isListed
        ? { value: value.filter(tool => tool.name !== 'Bash') }
        : listed
    })
  },
}
