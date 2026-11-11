import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the organization seats that adds a tool to the session.
 */
export const addingToolAsOrg: Plugin = {
  name: 'suite',
  tier: 'append',
  register(on) {
    on('tool.list', async ($, e, next) => {
      const listed = await next(e)
      const { value } = listed
      const isListed = value !== undefined

      return isListed
        ? {
            value: [
              ...value,
              { name: 'org_audit', description: 'Audits.', mcp: false },
            ],
          }
        : listed
    })
  },
}
