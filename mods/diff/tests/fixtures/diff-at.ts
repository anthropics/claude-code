import type { CommandRunInput } from 'claude-code'

import { DIFF } from './diff.js'

/**
 * The command typed under the fullscreen layout on a terminal so many
 * columns wide, as its presentation tells the hooks.
 *
 * @param columns the terminal's width
 * @returns the command's input
 */
export const diffAt = (columns: number): CommandRunInput => ({
  ...DIFF,
  presentation: { isFullscreen: true, columns },
})
