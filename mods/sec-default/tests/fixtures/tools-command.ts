import type { CommandRunInput } from 'claude-code'

import { FULLSCREEN } from './fullscreen.js'

/**
 * `/tools` as the person types it: the listing plugin's command.
 */
export const TOOLS_COMMAND: CommandRunInput = {
  command: 'tools',
  args: '',
  origin: { kind: 'composer' },
  presentation: FULLSCREEN,
}
