import type Types from '../../../types'
import { sparkHeightsOf } from './spark-heights-of'

/**
 * The height of every cell of a spark's lane: each slot's height, once for
 * each cell that a slot takes.
 *
 * @param row the series, as runs of samples without a gap
 * @param legend how wide the lane is
 * @param slotCount the slots that the lane has
 * @returns a height for each cell, or null where samples are missing
 */
export const cellHeightsOf = (
  row: Types.SparksChart['rows'][number],
  legend: Types.Legend,
  slotCount: number,
): Array<number | null> =>
  sparkHeightsOf(row.stretches, slotCount).flatMap(height =>
    Array.from(
      Array<number | null>(Math.floor(legend.laneWidth / slotCount)),
      () => height,
    ),
  )
