import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that leaves out every message the engine
 * injects for the model.
 */
export const droppingAttachments: Plugin = {
  name: 'dropping-attachments',
  register(on) {
    on('prompt.attachment', () => ({ text: null }))
  },
}
