import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that answers every `$.ui.log` itself, so no
 * line it hears reaches the transcript or the debug log.
 */
export const logSwallowing: Plugin = {
  name: 'quiet',
  register(on) {
    on('ui.log', () => ({ value: undefined }))
  },
}
