import type { Tick } from './tick'

/**
 * The marks of a value axis and where a value falls along it.
 */
export type ValueAxis = {
  ticks: Tick[]

  /**
   * Where a value falls: 0 at the lowest tick and 1 at the highest.
   */
  positionOf: (value: number) => number
}
