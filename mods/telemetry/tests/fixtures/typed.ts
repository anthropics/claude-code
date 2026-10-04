import type { CommandRunInput } from 'claude-code'

import { FULLSCREEN } from './fullscreen.js'

/**
 * A command typed at the prompt with an entry as its argument.
 *
 * @param command the command's name
 * @param entry what it carries
 * @returns the command as the person would run it
 */
export const typed = (command: string, entry: unknown): CommandRunInput => ({
  command,
  args: JSON.stringify(entry),
  origin: { kind: 'composer' },
  presentation: FULLSCREEN,
})
