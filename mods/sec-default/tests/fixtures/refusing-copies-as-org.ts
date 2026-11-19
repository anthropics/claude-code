import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the organization seats that refuses at every `vcs` event.
 */
export const refusingCopiesAsOrg: Plugin = {
  name: 'suite',
  tier: 'append',
  register(on) {
    on('vcs.isolate', () => ({ deny: 'org' }))
    on('vcs.list', () => [])
    on('vcs.status', () => ({ unknown: 'org' }))
    on('vcs.release', () => ({ kept: 'org' }))
  },
}
