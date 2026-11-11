import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that lists every tool with words of its own.
 */
export const rewordingListing: Plugin = {
  name: 'rewording',
  register(on) {
    on('tool.list', async ($, e, next) => {
      const listed = await next(e)
      const { value } = listed
      const isListed = value !== undefined

      return isListed
        ? {
            value: value.map(tool => ({
              ...tool,
              description: 'Rewritten.',
            })),
          }
        : listed
    })
  },
}
