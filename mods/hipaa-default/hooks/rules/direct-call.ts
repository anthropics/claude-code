import type { Args, EventResult, NextOrigin } from 'claude-code'

import { blockedToolRefusal } from './blocked-tool.js'
import { unreadCeilingRefusal } from './unread-ceiling.js'

const SETTINGS = /\/\.claude(\/(settings(\.local)?|cowork_settings)\.json)?$/

/**
 * The refusal of a mod's own file or process call, by the rule its tool twin
 * meets. A built-in's, and sec-default's settings look, is decided beneath.
 *
 * @param e the twin's check
 * @param origin who makes the call (`next.origin`)
 * @returns the deny, or undefined for a call decided beneath
 */
export function directCallRefusal(
  { tool, ceiling, op, input }: Args<'tool.check'>,
  origin: NextOrigin,
): EventResult<'tool.check'> | undefined {
  const refusal = ceiling === 'deny' ? blockedToolRefusal : unreadCeilingRefusal
  const isBeneath =
    origin.tier === 'builtin' ||
    (origin.provenance === 'cc-plugin-sec-default@builtin' &&
      op === 'fs.stat' &&
      SETTINGS.test(Object(input).file_path))

  return isBeneath ? undefined : refusal(tool, origin)
}
