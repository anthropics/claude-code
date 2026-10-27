import type { CommandRunInput } from 'claude-code'

import { FULLSCREEN } from './fullscreen.js'

/**
 * The command that has the marking plugin mark an entry, typed as the
 * person would type it; an entry that is no object rides as it is.
 *
 * @param entry what to mark
 * @returns `/mark <entry>`
 */
export const mark = (entry: unknown): CommandRunInput => ({
  command: 'mark',
  args: JSON.stringify(entry),
  origin: { kind: 'composer' },
  presentation: FULLSCREEN,
})
