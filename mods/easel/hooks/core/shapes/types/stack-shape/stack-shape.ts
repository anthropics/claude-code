import type { Point } from '../point'
import type { StackPart } from '../stack-part'

/**
 * A column of parts that stand one on another, the first at the bottom.
 */
export type StackShape = {
  kind: 'stack'

  /**
   * The left side of the column, and the y that its first part stands on.
   */
  at: Point

  width: number
  parts: StackPart[]
}
