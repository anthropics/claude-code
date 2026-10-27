import type { RenderInput } from 'claude-code'

import { HINT } from './hint.js'

/**
 * The prompt's hint on the same wide terminal on its main screen
 * (`CLAUDE_CODE_NO_FLICKER=0`), where nothing docks and a pane opens inline.
 */
export const MAIN_SCREEN_HINT: RenderInput<'PromptHint'> = {
  ...HINT,
  viewport: { columns: 160, rows: 40, isFullscreen: false },
}
