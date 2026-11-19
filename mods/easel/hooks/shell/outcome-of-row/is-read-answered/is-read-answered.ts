import type Types from '../../types'

/**
 * An empty list means that the read was refused, which settles nothing.
 *
 * @param calls what a read of the transcript gave
 * @returns whether the host let the conversation be read
 */
export const isReadAnswered = (calls: readonly Types.FinishedCall[]): boolean =>
  calls.length > 0
