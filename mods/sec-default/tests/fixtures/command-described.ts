import type { CommandDescribeInput, Origin } from 'claude-code'

/**
 * A visible command's description as the engine asks for it, pinned to
 * who provides the command.
 *
 * @param command the command's name, no slash
 * @param provider who provides it, as the engine pinned it
 * @returns the `command.describe` input
 */
export const commandDescribed = (
  command: string,
  provider: Origin,
): CommandDescribeInput => ({
  command,
  description: 'd',
  isHidden: false,
  immediate: false,
  provider,
})
