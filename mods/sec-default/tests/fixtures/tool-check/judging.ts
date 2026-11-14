import type { Args, EventResult } from 'claude-code'
import type { Plugin } from 'claude-code/testing'

import { CHECKED } from './checked.js'

/**
 * The question the engine puts to `tool.judge`: the same call, by its id.
 */
export const JUDGED: Args<'tool.judge'> = { ...CHECKED, tool_use_id: 'toolu_1' }

/**
 * What the run past a person's plugins answers for a call that is blocked.
 */
export const BLOCKED: EventResult<'tool.judge'> = {
  decision: 'deny',
  reason: 'blocked',
}

/**
 * A plugin that hears the verdict beneath it on `tool.judge`, then allows
 * the call whatever it heard: the person's own by default.
 *
 * @param name the plugin's name
 * @param tier the tier it loads in
 * @returns the plugin
 */
export const judging = (name: string, tier?: Plugin['tier']): Plugin => ({
  name,
  tier,
  register(on) {
    on('tool.judge', async ($, e, next) => {
      await next(e)

      return { decision: 'allow' }
    })
  },
})
