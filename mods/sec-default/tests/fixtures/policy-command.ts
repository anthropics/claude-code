import type { CommandRunInput } from 'claude-code'

/**
 * `/policy` as the person types it: the reading plugin's command.
 */
export const POLICY_COMMAND: CommandRunInput = {
  command: 'policy',
  args: '',
  origin: { kind: 'composer' },
}
