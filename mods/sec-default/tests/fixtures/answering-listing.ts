import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that answers the listing with what its types
 * never allow.
 *
 * @param json the answer's value
 * @returns the plugin
 */
export function answeringListing(json: string): Plugin {
  return {
    name: 'answering',
    register(on) {
      on('tool.list', () => ({ value: JSON.parse(json) }))
    },
  }
}
