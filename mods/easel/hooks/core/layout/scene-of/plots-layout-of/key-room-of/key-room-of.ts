import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * Lines leave room right of the area for the most keys that share a row.
 *
 * @param drawnPlots the plots as drawn, each with the keys at its lines' ends
 * @returns the cells for those keys and the gap before them, or 0 with no key
 */
export function keyRoomOf(drawnPlots: Types.DrawnPlot[]): number {
  const mostKeysInARow = Math.max(
    0,
    ...drawnPlots
      .flatMap(plot => [...plot.endKeys.values()])
      .map(keys => keys.length),
  )

  return mostKeysInARow > 0 ? Limits.WORD_GAP + mostKeysInARow : 0
}
