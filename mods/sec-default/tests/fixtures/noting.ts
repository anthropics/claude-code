import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that appends a note of its own to the conversation when the
 * session starts, and logs what was kept of it, in the tier given: the
 * person's own by default.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const noting = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('session.start', async ($, e, next) => {
      const kept = await $.session.append({
        message: { type: 'user', content: [{ type: 'text', text: 'a note' }] },
      })

      await $.ui.log(JSON.stringify(kept.message?.content ?? kept.deny))

      return next(e)
    })
  },
})
