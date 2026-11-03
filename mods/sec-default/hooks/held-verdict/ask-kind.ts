import type { EventResult } from 'claude-code'

import { pluginOf } from './verdicts/plugin-of.js'

/**
 * Names who asked, where no rule decided a verdict that holds: the classic
 * hook first, then the setting whose check asked, then the plugin that made
 * it, then the ceiling an organization set on the tool.
 *
 * An ask that names none of them holds by the host that answers it.
 *
 * @param held the ask in question
 * @returns `<event> hook's ask`, `<key> setting's ask`, `<plugin>'s ask`,
 *   `ask cap`, or `host's ask`
 */
export function askKind(held: EventResult<'tool.check'>) {
  const plugin = pluginOf(held)
  const isHooked = held.hook !== undefined
  const isSet = held.setting !== undefined
  const isMade = plugin !== undefined
  const isCapped = held.ceiling !== undefined

  return isHooked
    ? `${held.hook} hook's ask`
    : isSet
      ? `${held.setting} setting's ask`
      : isMade
        ? `${plugin}'s ask`
        : isCapped
          ? 'ask cap'
          : "host's ask"
}
