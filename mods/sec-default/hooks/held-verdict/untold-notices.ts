import type { EventResult } from 'claude-code'

import { heldKind } from './held-kind.js'
import { heldNotice } from './held-notice.js'
import Verdicts from './verdicts'

/**
 * The notices of one hold that no earlier one gave, noted as given.
 *
 * @param told each plugin and kind told so far, added to here
 * @param mods the plugins that rewrote the verdict
 * @param tool the tool the call named
 * @param verdicts the one that holds, and the one it holds over
 * @returns the lines to show
 */
export function untoldNotices(
  told: Set<string>,
  mods: readonly string[],
  tool: string,
  { held, answer }: Record<'held' | 'answer', EventResult<'tool.check'>>,
): string[] {
  const kind = heldKind(held)
  const attempt = Verdicts.isLooser(answer, held) ? 'lift' : 'reword'

  return [...new Set(mods)]
    .filter(mod => !told.has(`${mod} ${kind}`))
    .map(mod => {
      told.add(`${mod} ${kind}`)

      return heldNotice(mod, tool, held, attempt)
    })
}
