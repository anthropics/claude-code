import type { CommandPresentation } from 'claude-code'

/**
 * Where a typed command's answer shows in these tests: the fullscreen
 * layout on a 160-column terminal.
 */
export const FULLSCREEN: CommandPresentation = {
  isFullscreen: true,
  columns: 160,
}
