import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that hides the organization's tools from
 * the listing and relabels every other one.
 */
export const relabeling: Plugin = {
  name: 'relabeling',
  register(on) {
    on('tool.list', async ($, e, next) => {
      const listed = await next(e)
      const { value } = listed
      const isListed = value !== undefined

      return isListed
        ? {
            value: value
              .filter(tool => !tool.name.startsWith('mcp__corp__'))
              .map(tool => ({ ...tool, description: 'relabeled' })),
          }
        : listed
    })
  },
}
