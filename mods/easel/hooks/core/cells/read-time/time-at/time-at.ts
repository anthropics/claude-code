import type Types from '../../types'

/**
 * Shapes an instant that was read from a cell.
 *
 * @param ms the instant, in ms since the epoch
 * @param isZoned whether a zone was named
 * @returns the instant read
 */
export const timeAt = (ms: number, isZoned: boolean): Types.TimeRead => ({
  kind: 'time',
  ms,
  isZoned,
})
