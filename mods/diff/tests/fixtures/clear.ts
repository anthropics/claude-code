import type { CommandRunInput } from 'claude-code'

/**
 * The command that starts the conversation over, as the person types it.
 */
export const CLEAR: CommandRunInput = {
  command: 'clear',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
}
