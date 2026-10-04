import type { CommandRunInput } from 'claude-code'

/**
 * The command that brings an earlier conversation back, as the person types
 * it under the fullscreen layout on a 160-column terminal.
 */
export const RESUME: CommandRunInput = {
  command: 'resume',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
}
