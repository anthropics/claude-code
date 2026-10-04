import type { RenderInput } from 'claude-code'

import { HINT } from './hint.js'

/**
 * The prompt's hint from a surface that measured its size but did not say
 * whether it docks a pane: an engine that predates the word, or a remote
 * surface that has not reported it.
 */
export const UNSAID_HINT: RenderInput<'PromptHint'> = {
  ...HINT,
  viewport: { columns: 160, rows: 40 },
}
