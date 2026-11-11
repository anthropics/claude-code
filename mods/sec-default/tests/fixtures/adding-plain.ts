import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that adds a tool of a name of its own.
 */
export const addingPlain: Plugin = {
  name: 'adding',
  register(on) {
    on('tool.list', async ($, e, next) => {
      const listed = await next(e)
      const { value } = listed
      const isListed = value !== undefined

      return isListed
        ? {
            value: [
              ...value,
              { name: 'mine_added', description: 'Added.', mcp: false },
            ],
          }
        : listed
    })
  },
}
