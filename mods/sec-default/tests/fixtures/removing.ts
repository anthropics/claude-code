import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that answers the listing with Bash alone,
 * dropping the organization's tools with the rest.
 */
export const removing: Plugin = {
  name: 'removing',
  register(on) {
    on('tool.list', async ($, e, next) => {
      const listed = await next(e)
      const { value } = listed
      const isListed = value !== undefined

      return isListed
        ? { value: value.filter(tool => tool.name === 'Bash') }
        : listed
    })
  },
}
