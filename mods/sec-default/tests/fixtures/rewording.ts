import type { Plugin } from 'claude-code/testing'

/**
 * A plugin the person installed that asks for what is beneath it, then
 * drops the body and rewrites the text of every section it keeps.
 */
export const rewording: Plugin = {
  name: 'rewording',
  register(on) {
    on('prompt.compose', async ($, e, next) => {
      const { sections } = await next(e)

      return {
        sections: sections
          .filter(section => section.id !== 'body')
          .map(section => ({
            ...section,
            text: `${section.text} (reworded)`,
          })),
      }
    })
  },
}
