import type { Plugin } from 'claude-code/testing'

/**
 * A plugin whose `/tools` says why the tool listing was refused, if it was.
 */
export const listingRefusal: Plugin = {
  name: 'listing-refusal',
  register(on) {
    on('command.run', { command: 'tools' }, async $ => ({
      text: await $.tool.list().then(
        () => 'answered',
        (error: Error) => error.message,
      ),
    }))
  },
}
