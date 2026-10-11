import type { EventResult } from 'claude-code'

import { heldKind } from './held-kind.js'

/**
 * What a person reads, once for each plugin and kind in a session, when a
 * plugin they installed rewrote a verdict that holds over it.
 *
 * It names the option an administrator sets to let such plugins override.
 *
 * @param plugin the plugin's name, or its batch's, as the trace names it
 * @param tool the tool the call named
 * @param held the verdict that holds, naming the rule behind it if one is
 * @param attempt what the plugin did: answered looser, or the same reworded
 * @returns the line
 */
export function heldNotice(
  plugin: string,
  tool: string,
  held: EventResult<'tool.check'>,
  attempt: 'lift' | 'reword',
): string {
  const kind = heldKind(held)
  const article = kind.startsWith('a') ? 'an' : 'a'
  const changed =
    held.rule === undefined
      ? `${article} ${kind} from a ${tool} call`
      : `${article} ${kind} in your settings from a ${tool} call (${held.rule})`

  return (
    `${plugin} tried to ${attempt} ${changed}; the ${kind} holds over the ` +
    'plugins you install (allowModsToOverrideDenyRules)'
  )
}
