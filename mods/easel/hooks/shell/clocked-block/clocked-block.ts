import type Types from '../types'

/**
 * The one block of a chart call's result: its words, with the time and the
 * zone of the call kept beside them for later redraws.
 *
 * @param text the words that the model reads for the chart
 * @param clock the time and the zone that the chart was drawn with
 * @returns the block as the host stores it
 */
export const clockedBlock = (
  text: string,
  clock: Types.StoredClock,
): Types.ClockedBlock => ({
  type: 'text',
  text,
  _meta: { easel: clock },
})
