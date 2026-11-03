import type { Plugin } from 'claude-code/testing'

/**
 * A plugin whose `/tools` answers the tool listing it reads, one
 * `name: description` line per tool.
 */
export const listing: Plugin = {
  name: 'listing',
  register(on) {
    on('command.run', { command: 'tools' }, async $ => ({
      text: (await $.tool.list())
        .map(tool => `${tool.name}: ${tool.description}`)
        .join('\n'),
    }))
  },
}
