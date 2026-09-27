import type { CommandRunInput } from 'claude-code'

import { FULLSCREEN } from './fullscreen.js'

/**
 * `/export` as the person types it: the exporting plugin's command.
 */
export const EXPORT_COMMAND: CommandRunInput = {
  command: 'export',
  args: '',
  origin: { kind: 'composer' },
  presentation: FULLSCREEN,
}
