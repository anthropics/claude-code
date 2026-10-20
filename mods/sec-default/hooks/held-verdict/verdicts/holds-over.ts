import type { EventResult } from 'claude-code'

import { isSameVerdict } from './is-same-verdict.js'
import { pluginOf } from './plugin-of.js'
import Ranking from './ranking'

/**
 * Whether the verdict reached past the user tier holds whole over the
 * chain's answer: a deny, or an ask that names what stands behind it.
 *
 * It holds over a more permissive answer and over the same decision reworded
 * or stripped of what it names; a stricter answer stands. A rule, a hook, a
 * setting, a plugin or a ceiling counts, and a host answering the ask; the
 * mode's own ask at a dialog never. The run past the user tier holds no
 * person's plugin, so a plugin it names is a built-in or an organization's.
 *
 * @param held what the run past the user tier settled on
 * @param answer what the whole chain settled on
 * @param approver who answers this evaluation's asks (`e.approver`)
 * @returns true when the held verdict is the one to return, as it is
 */
export function holdsOver(
  held: EventResult<'tool.check'>,
  answer: EventResult<'tool.check'>,
  approver: string | undefined,
): boolean {
  const isAsked = held.decision === 'ask'

  return (
    !Ranking.isLooser(held, answer) &&
    !isSameVerdict(held, answer) &&
    (held.decision === 'deny' ||
      held.rule !== undefined ||
      held.hook !== undefined ||
      held.setting !== undefined ||
      pluginOf(held) !== undefined ||
      held.ceiling !== undefined ||
      (isAsked && approver === 'host'))
  )
}
