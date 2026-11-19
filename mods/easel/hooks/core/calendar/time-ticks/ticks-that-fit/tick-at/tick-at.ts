import Limits from '../../../limits'
import type Types from '../../../types'

/**
 * Lays a label at its instant, moved left where it is centred or would
 * pass the right edge. A start below 0 tells a label wider than the room.
 *
 * @param labels one label for each instant, in the order of the instants
 * @param axis the width of the axis, and where an instant sits on it
 * @returns a function from an instant and its index to its tick
 */
export const tickAt =
  (labels: readonly string[], axis: Types.TickAxis) =>
  (ms: number, index: number): Types.TimeTick => {
    const text = labels[index] ?? ''
    const column = axis.columnOf(ms)

    return {
      text,
      column,
      start: Math.min(
        Math.max(
          0,
          column -
            (axis.areCentred
              ? Math.floor((text.length - 1) / Limits.HALVES)
              : 0),
        ),
        axis.columns - text.length,
      ),
    }
  }
