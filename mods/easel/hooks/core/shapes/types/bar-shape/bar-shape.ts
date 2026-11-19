import type { Ink } from '../ink'
import type { Point } from '../point'

/**
 * One row filled from its first cell over a width, for a single value.
 */
export type BarShape = {
  kind: 'bar'
  at: Point
  width: number
  ink: Ink

  /**
   * The value is below zero. This must show without colour too.
   */
  isHatched: boolean
}
