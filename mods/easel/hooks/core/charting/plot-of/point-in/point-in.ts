import type Numbers from '../../../numbers'
import type Shapes from '../../../shapes'
import type Types from '../../types'

/**
 * A sample is drawn where its time falls along the time axis and its top up
 * the value axis, both from 0 to 1.
 *
 * @param timePositionOf tells how far along the time axis a time stands
 * @param valueAxis the axis the tops are laid on
 * @returns tells where a sample is drawn
 */
export const pointIn =
  (
    timePositionOf: (ms: number) => number,
    valueAxis: Numbers.ValueAxis,
  ): ((sampleTop: Types.Top) => Shapes.Point) =>
  sampleTop => ({
    x: timePositionOf(sampleTop.ms),
    y: valueAxis.positionOf(sampleTop.top),
  })
