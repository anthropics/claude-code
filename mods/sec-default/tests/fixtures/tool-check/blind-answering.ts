import type { EventResult } from 'claude-code'
import type { Plugin } from 'claude-code/testing'

/**
 * A plugin that answers `tool.check` without calling `next`, so nothing
 * beneath it runs: the person's own by default.
 *
 * @param name the plugin's name
 * @param verdict what it answers
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const blindAnswering = (
  name: string,
  verdict: EventResult<'tool.check'>,
  tier?: Plugin['tier'],
): Plugin => ({
  name,
  tier,
  register(on) {
    on('tool.check', () => verdict)
  },
})
