import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that allows every Read call and has no say
 * on another tool's.
 */
export const allowingRead: Plugin = {
  name: 'reader',
  register(on) {
    on('tool.check', { tool: 'Read' }, () => ({ decision: 'allow' }))
  },
}
