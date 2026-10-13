import type { EventResult } from 'claude-code'

/**
 * Names who asked, where no rule decided a verdict that holds: the classic
 * hook first, then the setting whose check asked, then the host it goes to.
 *
 * An ask that names none of the three holds by the ceiling an organization
 * set on the tool.
 *
 * @param held the ask in question
 * @returns `<event> hook's ask`, `<key> setting's ask`, `host's ask`, or
 *   `ask cap`
 */
export function askKind(held: EventResult<'tool.check'>) {
  const isHooked = held.hook !== undefined
  const isSet = held.setting !== undefined
  const isHosted = held.decider !== undefined

  return isHooked
    ? `${held.hook} hook's ask`
    : isSet
      ? `${held.setting} setting's ask`
      : isHosted
        ? `${held.decider}'s ask`
        : 'ask cap'
}
