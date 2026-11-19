import Lists from '../../../../../lists'
import type Shapes from '../../../../../shapes'
import Limits from '../../../../limits'
import { fartherOf } from './farther-of'
import { slotOf } from './slot-of'

/**
 * A sample lasts until the next of its stretch, so a slot is null only where
 * samples are missing.
 *
 * A slot shows the sample farthest from the series' mean, as a share of a row,
 * so that neither a spike nor a dip is lost.
 *
 * @param stretches the samples of a series, in runs without a gap
 * @param slotCount the slots that the lane has
 * @returns a height for each slot, or null where samples are missing
 */
export function sparkHeightsOf(
  stretches: Shapes.Point[][],
  slotCount: number,
): Array<number | null> {
  const heights: Array<number | null> = Array.from(
    Array<null>(slotCount),
    () => null,
  )
  const values = stretches.flat().map(sample => sample.y)
  const mean = Lists.sumOf(values) / values.length
  const slotAt = slotOf(slotCount)

  for (const stretch of stretches) {
    for (const [sampleIndex, sample] of stretch.entries()) {
      const firstSlot = slotAt(sample.x)
      const lastSlot = Math.max(
        firstSlot,
        slotAt(stretch[sampleIndex + 1]?.x ?? sample.x) - 1,
      )

      for (let slot = firstSlot; slot <= lastSlot; slot++) {
        heights[slot] = Math.max(
          Limits.MIN_INK,
          fartherOf(mean, sample.y, heights[slot] ?? sample.y),
        )
      }
    }
  }

  return heights
}
