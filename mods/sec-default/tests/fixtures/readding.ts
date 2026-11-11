import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that lists Bash whatever the tiers beneath it
 * left.
 */
export const readding: Plugin = {
  name: 'readding',
  register(on) {
    on('tool.list', async ($, e, next) => {
      const listed = await next(e)
      const { value } = listed
      const isListed = value !== undefined

      return isListed
        ? {
            value: [
              ...value,
              { name: 'Bash', description: 'Runs a command.', mcp: false },
            ],
          }
        : listed
    })
  },
}
