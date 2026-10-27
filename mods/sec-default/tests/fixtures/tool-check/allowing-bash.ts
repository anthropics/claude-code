import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that allows every Bash call and has no say
 * on another tool's.
 */
export const allowingBash: Plugin = {
  name: 'basher',
  register(on) {
    on('tool.check', { tool: 'Bash' }, () => ({ decision: 'allow' }))
  },
}
