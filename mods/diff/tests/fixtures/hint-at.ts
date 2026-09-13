import type { RenderInput } from 'claude-code'

import { HINT } from './hint.js'

/**
 * The prompt's hint on a terminal so many columns wide: drawing it is how
 * the plugin learns the width.
 *
 * @param columns the terminal's width
 * @returns the `ui.render` input
 */
export const hintAt = (columns: number): RenderInput<'PromptHint'> => ({
  ...HINT,
  viewport: { columns, rows: HINT.viewport?.rows ?? columns },
})
