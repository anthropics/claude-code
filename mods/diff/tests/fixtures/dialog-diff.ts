import type { CommandRunInput } from 'claude-code'

import { DIFF } from './diff.js'

/**
 * The command as the person types it on the main screen (no fullscreen
 * layout), where the built-in answers with its dialog.
 */
export const DIALOG_DIFF: CommandRunInput = {
  ...DIFF,
  presentation: { isFullscreen: false, columns: 100 },
}
