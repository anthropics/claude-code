import Limits from '../../limits'
import { timeLabels } from '../../time-labels'
import type Types from '../../types'
import { tickAt } from './tick-at'

/**
 * Keeps the ticks only where every label has room before the next: all
 * of them, or none.
 *
 * @param labelling how the labels of the ticks are written
 * @param axis the width of the axis, and where an instant sits on it
 * @returns a function from instants and their step to the ticks that fit
 */
export const ticksThatFit =
  (labelling: Types.Labelling, axis: Types.TickAxis) =>
  (instants: number[], step: Types.Step): Types.TimeTick[] => {
    const ticks = instants.map(
      tickAt(timeLabels(instants, step, labelling), axis),
    )
    const hasRoomForAll = ticks.every(
      (tick, index) =>
        tick.start >= 0 &&
        tick.start + tick.text.length + Limits.LABEL_GAP <=
          (ticks[index + 1]?.start ?? Infinity),
    )

    return hasRoomForAll ? ticks : []
  }
