import type { CommandRunInput } from 'claude-code'

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
})
