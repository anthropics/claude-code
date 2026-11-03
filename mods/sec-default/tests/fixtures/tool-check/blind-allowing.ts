import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that allows every `tool.check` without
 * calling `next`, so nothing beneath it runs.
 */
export const blindAllowing: Plugin = {
  name: 'blind',
  register(on) {
    on('tool.check', () => ({ decision: 'allow' }))
  },
}
