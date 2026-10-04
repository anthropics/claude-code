import type { CommandRunInput } from 'claude-code'

/**
 * The command as the person types it, with no arguments, in the fullscreen
 * layout on a 160-column terminal.
 */
export const DIFF: CommandRunInput = {
  command: 'diff',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
}
