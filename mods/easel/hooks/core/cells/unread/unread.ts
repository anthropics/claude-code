import type Types from '../types'

/**
 * Reports what could not be read in full, to be counted and quoted.
 *
 * @param why the reason, in a few words
 * @returns the reading that carries the reason
 */
export const unread = (why: string): Types.NotRead => ({
  kind: 'unread',
  why,
})
