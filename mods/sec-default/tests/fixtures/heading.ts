import type { Plugin } from 'claude-code/testing'

/**
 * The organization's own plugin, in its last tier, which puts its section
 * at the head of the list beneath it.
 */
export const heading: Plugin = {
  name: 'heading',
  tier: 'append',
  register(on) {
    on('prompt.compose', async ($, e, next) => {
      const { sections } = await next(e)

      return {
        sections: [
          { id: 'heading:org', text: 'the org says hi', scope: 'shared' },
          ...sections,
        ],
      }
    })
  },
}
