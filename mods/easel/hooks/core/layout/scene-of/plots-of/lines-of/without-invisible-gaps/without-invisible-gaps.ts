import type Shapes from '../../../../../shapes'
import Limits from '../../../../limits'
import type Types from '../../../../types'

/**
 * Also leaves no more runs of ink than the plot has cells, whatever the data.
 *
 * @param stretches the stretches of a series, in cells
 * @returns the stretches, with those joined that no visible gap parts
 */
export function withoutInvisibleGaps(
  stretches: Shapes.Point[][],
): Types.Stretch[] {
  const joined: Types.Stretch[] = []
  let open: Shapes.Point[] = []
  let inkEnd = -Infinity

  for (const [first, ...others] of stretches) {
    if (first === undefined) {
      continue
    }

    const dashReach = others.length === 0 ? Limits.HALF_CELL : 0
    const isJoinedToOpen = first.x - dashReach - inkEnd < Limits.MIN_VISIBLE_GAP

    if (isJoinedToOpen) {
      open.push(first, ...others)
    } else {
      const opened: Types.Stretch = [first, ...others]

      joined.push(opened)
      open = opened
    }

    inkEnd = (others.at(-1) ?? first).x + dashReach
  }

  return joined
}
