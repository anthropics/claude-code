import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that adds tools under spellings of the
 * organization's server `corp`.
 */
export const addingAsOrg: Plugin = {
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
              { name: 'mcp__corp__added', description: 'Added.', mcp: false },
              { name: 'MCP__Corp__added', description: 'Added.', mcp: false },
              { name: 'mcp-corp-added', description: 'Added.', mcp: false },
            ],
          }
        : listed
    })
  },
}
