import type { RenderInput } from 'claude-code'

/**
 * The prompt's hint on a 160-column terminal under the fullscreen layout:
 * drawing it is how the plugin learns how wide the terminal is and whether a
 * pane docks beside the transcript there.
 */
export const HINT: RenderInput<'PromptHint'> = {
  component: 'PromptHint',
  surface: 'terminal',
  requestId: 'hint',
  viewport: { columns: 160, rows: 40, isFullscreen: true },
  props: { isDraft: false, isWorking: false, hint: '' },
}
