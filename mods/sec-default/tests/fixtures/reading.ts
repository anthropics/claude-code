import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed whose `/policy` answers the managed
 * settings it reads, as JSON.
 */
export const reading: Plugin = {
  name: 'reading',
  register(on) {
    on('command.run', { command: 'policy' }, async $ => ({
      text: JSON.stringify(await $.settings.read({ source: 'policy' })),
    }))
  },
}
